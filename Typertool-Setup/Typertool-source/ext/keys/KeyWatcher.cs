// Typertool key watcher: tells the panel when one of its shortcuts is pressed.
//
// It runs as a separate little process (started by the panel through PowerShell), so
// Photoshop is never asked anything. It prints one line per press on its standard output:
//     READY hook | READY poll    once, when it is running (see below)
//     KEY <command>              a shortcut was pressed (only while Photoshop is the active window)
// It stops by itself when the panel (its parent process) is gone or nobody reads its output.
//
// Two ways to hear the keys:
//   hook  (default) a Windows low-level keyboard hook. The keys of a shortcut are swallowed, so
//         Photoshop never sees them: pressing Shift+F2 for "2 lines" does not also run what
//         Photoshop has on F2. Only the exact combinations you set are swallowed, and only
//         while Photoshop is the active window; every other key goes through untouched.
//   poll  (fallback / "block" off) looks at the keys every 25 ms without touching them.
//
// Arguments: "<command>:<MODS>:<vk>,<vk>;..."  e.g. "3:ALT:51,99;best:ALT:48,96"
//   MODS = + separated ALT CTRL SHIFT WIN (or NONE), vk = Windows virtual key codes (decimal).
//
// Written for the C# 5 compiler that ships with Windows PowerShell (Add-Type).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

namespace Typertool
{
    public class Binding
    {
        public string Command;
        public int Mods;       // bit 1 = ALT, 2 = CTRL, 4 = SHIFT, 8 = WIN
        public int[] Keys;
    }

    // What the watcher needs from the keyboard / the window system (replaced by a fake in the tests)
    public interface IKeyboard
    {
        bool IsDown(int vk);
        bool PhotoshopIsActive();
    }

    public class Press
    {
        public bool Swallow;    // keep the key away from Photoshop
        public string Command;  // the shortcut to run (null: none, e.g. a key repeat)
    }

    // What to do with one key event of the hook (pure logic: no Windows calls)
    public class ComboMatcher
    {
        private readonly List<Binding> bindings;
        private readonly bool block;
        private readonly HashSet<int> held = new HashSet<int>();      // shortcut keys that are down now
        private readonly HashSet<int> swallowed = new HashSet<int>(); // keys whose key-down was swallowed

        public ComboMatcher(List<Binding> bindings, bool block)
        {
            this.bindings = bindings;
            this.block = block;
        }

        // vk: the key; isDown: key-down or key-up; mods: the modifiers held now;
        // photoshopActive is asked only when a shortcut matches
        public Press Handle(int vk, bool isDown, int mods, Func<bool> photoshopActive)
        {
            Press press = new Press();
            if (!isDown)
            {
                held.Remove(vk);
                // the key-up of a swallowed key is swallowed too, even if the modifiers are released first
                if (swallowed.Remove(vk)) press.Swallow = true;
                return press;
            }
            Binding hit = null;
            foreach (Binding binding in bindings)
            {
                if (binding.Mods != mods) continue;
                foreach (int key in binding.Keys)
                    if (key == vk) { hit = binding; break; }
                if (hit != null) break;
            }
            if (hit == null) return press;
            if (!photoshopActive()) return press;
            bool repeat = held.Contains(vk);
            held.Add(vk);
            if (block)
            {
                swallowed.Add(vk);
                press.Swallow = true;
            }
            if (!repeat) press.Command = hit.Command;
            return press;
        }
    }

    public class KeyWatcher
    {
        public const int ALT = 1, CTRL = 2, SHIFT = 4, WIN = 8;

        public static List<Binding> Parse(string text)
        {
            List<Binding> list = new List<Binding>();
            if (string.IsNullOrEmpty(text)) return list;
            foreach (string item in text.Split(';'))
            {
                string[] parts = item.Split(':');
                if (parts.Length != 3 || parts[0].Length == 0) continue;
                Binding binding = new Binding();
                binding.Command = parts[0];
                foreach (string mod in parts[1].ToUpperInvariant().Split('+'))
                {
                    if (mod == "ALT") binding.Mods |= ALT;
                    else if (mod == "CTRL") binding.Mods |= CTRL;
                    else if (mod == "SHIFT") binding.Mods |= SHIFT;
                    else if (mod == "WIN") binding.Mods |= WIN;
                }
                List<int> keys = new List<int>();
                foreach (string key in parts[2].Split(','))
                {
                    int vk;
                    if (int.TryParse(key, out vk) && vk > 0) keys.Add(vk);
                }
                if (keys.Count == 0) continue;
                binding.Keys = keys.ToArray();
                list.Add(binding);
            }
            return list;
        }

        private readonly List<Binding> bindings;
        private readonly IKeyboard keyboard;
        private string last = null;

        public KeyWatcher(List<Binding> bindings, IKeyboard keyboard)
        {
            this.bindings = bindings;
            this.keyboard = keyboard;
        }

        private int Modifiers()
        {
            int mods = 0;
            if (keyboard.IsDown(0x12)) mods |= ALT;
            if (keyboard.IsDown(0x11)) mods |= CTRL;
            if (keyboard.IsDown(0x10)) mods |= SHIFT;
            if (keyboard.IsDown(0x5B) || keyboard.IsDown(0x5C)) mods |= WIN;
            return mods;
        }

        // The command whose exact combination is held down now, or null
        private string Held()
        {
            int mods = Modifiers();
            foreach (Binding binding in bindings)
            {
                if (binding.Mods != mods) continue;
                foreach (int vk in binding.Keys)
                    if (keyboard.IsDown(vk)) return binding.Command;
            }
            return null;
        }

        // One look at the keyboard: the command to run (once per press), or null
        public string Tick()
        {
            string held = Held();
            if (held == null)
            {
                last = null;
                return null;
            }
            if (held == last) return null;
            // only a Photoshop window gets the shortcuts (checked only when a combination is held)
            if (!keyboard.PhotoshopIsActive())
            {
                last = held; // do not fire when the user comes back to Photoshop with the keys still down
                return null;
            }
            last = held;
            return held;
        }

        private static bool PanelIsGone(int parentPid)
        {
            if (parentPid <= 0) return false;
            try { Process.GetProcessById(parentPid); return false; }
            catch (ArgumentException) { return true; }
        }

        private static void Say(string line)
        {
            Console.Out.WriteLine(line);
            Console.Out.Flush();
        }

        public static void Run(int parentPid, string bindingText, bool block)
        {
            List<Binding> bindings = Parse(bindingText);
            try
            {
                if (block)
                {
                    HookRunner hook = new HookRunner(bindings);
                    if (hook.Start())
                    {
                        Say("READY hook");
                        while (true)
                        {
                            List<string> commands = hook.Wait(2000);
                            foreach (string command in commands) Say("KEY " + command);
                            if (PanelIsGone(parentPid)) return;
                        }
                    }
                    // the hook could not be installed: keys can still be heard, but not kept from Photoshop
                }
                KeyWatcher watcher = new KeyWatcher(bindings, new WindowsKeyboard());
                Say("READY poll");
                int ticks = 0;
                while (true)
                {
                    Thread.Sleep(25);
                    string command = watcher.Tick();
                    if (command != null) Say("KEY " + command);
                    if (++ticks % 80 == 0 && PanelIsGone(parentPid)) return;
                }
            }
            catch (Exception)
            {
                // the pipe is closed: nobody listens any more
            }
        }
    }

    // A Windows low-level keyboard hook that keeps the keys of a shortcut away from Photoshop.
    // The hook function does as little as possible (Windows removes a hook that is slow): it asks
    // the matcher, queues the command for the main thread and answers at once.
    public class HookRunner
    {
        private delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);
        [StructLayout(LayoutKind.Sequential)]
        private struct POINT { public int x; public int y; }
        [StructLayout(LayoutKind.Sequential)]
        private struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public POINT pt; }

        [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);
        [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hhk);
        [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
        [DllImport("user32.dll")] private static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);
        [DllImport("kernel32.dll")] private static extern IntPtr GetModuleHandle(string lpModuleName);

        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x100, WM_KEYUP = 0x101, WM_SYSKEYDOWN = 0x104, WM_SYSKEYUP = 0x105;
        private const int LLKHF_INJECTED = 0x10;

        private readonly ComboMatcher matcher;
        private readonly WindowsKeyboard keyboard = new WindowsKeyboard();
        private readonly Queue<string> queue = new Queue<string>();
        private readonly AutoResetEvent signal = new AutoResetEvent(false);
        private readonly ManualResetEvent installed = new ManualResetEvent(false);
        private HookProc proc; // kept in a field: the garbage collector must not free it
        private IntPtr hook = IntPtr.Zero;

        public HookRunner(List<Binding> bindings)
        {
            matcher = new ComboMatcher(bindings, true);
        }

        public bool Start()
        {
            Thread thread = new Thread(Loop);
            thread.IsBackground = true;
            thread.Start();
            installed.WaitOne(3000);
            return hook != IntPtr.Zero;
        }

        private void Loop()
        {
            try
            {
                proc = Callback;
                IntPtr module = GetModuleHandle(Process.GetCurrentProcess().MainModule.ModuleName);
                hook = SetWindowsHookEx(WH_KEYBOARD_LL, proc, module, 0);
            }
            catch (Exception)
            {
                hook = IntPtr.Zero;
            }
            installed.Set();
            if (hook == IntPtr.Zero) return;
            MSG message;
            while (GetMessage(out message, IntPtr.Zero, 0, 0) > 0) { } // the hook is served from this loop
            UnhookWindowsHookEx(hook);
        }

        private IntPtr Callback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            try
            {
                if (nCode >= 0)
                {
                    int msg = wParam.ToInt32();
                    bool down = msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN;
                    bool up = msg == WM_KEYUP || msg == WM_SYSKEYUP;
                    if (down || up)
                    {
                        int vk = Marshal.ReadInt32(lParam, 0);
                        int flags = Marshal.ReadInt32(lParam, 8);
                        if ((flags & LLKHF_INJECTED) == 0) // keys sent by programs are left alone
                        {
                            Press press = matcher.Handle(vk, down, keyboard.Modifiers(), delegate { return keyboard.PhotoshopIsActive(); });
                            if (press.Command != null)
                            {
                                lock (queue) { queue.Enqueue(press.Command); }
                                signal.Set();
                            }
                            if (press.Swallow) return (IntPtr)1;
                        }
                    }
                }
            }
            catch (Exception)
            {
                // never let a mistake of ours stop the keyboard: pass the key on
            }
            return CallNextHookEx(IntPtr.Zero, nCode, wParam, lParam);
        }

        // The commands pressed since the last call (waits up to `milliseconds` for one)
        public List<string> Wait(int milliseconds)
        {
            signal.WaitOne(milliseconds);
            List<string> commands = new List<string>();
            lock (queue)
            {
                while (queue.Count > 0) commands.Add(queue.Dequeue());
            }
            return commands;
        }
    }

    public class WindowsKeyboard : IKeyboard
    {
        [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int vKey);
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

        private IntPtr cachedWindow = IntPtr.Zero;
        private bool cachedAnswer = false;
        private long cachedAt = 0;

        public bool IsDown(int vk)
        {
            return (GetAsyncKeyState(vk) & 0x8000) != 0;
        }

        public int Modifiers()
        {
            int mods = 0;
            if (IsDown(0x12)) mods |= KeyWatcher.ALT;
            if (IsDown(0x11)) mods |= KeyWatcher.CTRL;
            if (IsDown(0x10)) mods |= KeyWatcher.SHIFT;
            if (IsDown(0x5B) || IsDown(0x5C)) mods |= KeyWatcher.WIN;
            return mods;
        }

        public bool PhotoshopIsActive()
        {
            try
            {
                IntPtr window = GetForegroundWindow();
                long now = Environment.TickCount;
                // the same window asked again within a second: same answer (the hook must stay fast)
                if (window == cachedWindow && now - cachedAt < 1000 && now >= cachedAt) return cachedAnswer;
                uint pid;
                GetWindowThreadProcessId(window, out pid);
                bool answer = false;
                if (pid != 0)
                    answer = Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant().Contains("photoshop");
                cachedWindow = window;
                cachedAnswer = answer;
                cachedAt = now;
                return answer;
            }
            catch (Exception)
            {
                return false;
            }
        }
    }
}
