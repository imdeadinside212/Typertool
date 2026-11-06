using System;
using System.Collections.Generic;
using Typertool;

class Fake : IKeyboard
{
    public HashSet<int> Down = new HashSet<int>();
    public bool Photoshop = true;
    public bool IsDown(int vk) { return Down.Contains(vk); }
    public bool PhotoshopIsActive() { return Photoshop; }
}

class T
{
    static int fails = 0;
    static void Check(bool ok, string what) { if (!ok) { fails++; Console.WriteLine("FAIL: " + what); } }
    static void Main()
    {
        string text = "1:ALT:49,97;3:ALT:51,99;best:ALT:48,96;q:CTRL+ALT:81;bad;x:ALT:;:ALT:49";
        List<Binding> list = KeyWatcher.Parse(text);
        Check(list.Count == 4, "parsed 4 valid bindings, got " + list.Count);
        Check(list[3].Mods == (KeyWatcher.CTRL | KeyWatcher.ALT), "CTRL+ALT mods");
        Check(KeyWatcher.Parse("").Count == 0 && KeyWatcher.Parse(null).Count == 0, "empty text");

        Fake kb = new Fake();
        KeyWatcher w = new KeyWatcher(list, kb);
        Check(w.Tick() == null, "nothing held");
        kb.Down.Add(0x12); // ALT alone
        Check(w.Tick() == null, "ALT alone");
        kb.Down.Add(51);   // ALT+3
        Check(w.Tick() == "3", "ALT+3 fires");
        Check(w.Tick() == null && w.Tick() == null, "held: fires once per press");
        kb.Down.Remove(51);
        Check(w.Tick() == null, "released");
        kb.Down.Add(99);   // numpad 3
        Check(w.Tick() == "3", "numpad 3 fires again after release");
        kb.Down.Remove(99);
        kb.Down.Remove(0x12);
        // ALT+0 -> best
        kb.Down.Add(0x12); kb.Down.Add(48);
        Check(w.Tick() == "best", "ALT+0 is best");
        kb.Down.Clear();
        w.Tick();
        // extra modifier must not match (ALT+SHIFT+3 is another shortcut, not ALT+3)
        kb.Down.Add(0x12); kb.Down.Add(0x10); kb.Down.Add(51);
        Check(w.Tick() == null, "ALT+SHIFT+3 does not fire ALT+3");
        kb.Down.Clear(); w.Tick();
        // CTRL+ALT+Q
        kb.Down.Add(0x11); kb.Down.Add(0x12); kb.Down.Add(81);
        Check(w.Tick() == "q", "CTRL+ALT+Q fires q");
        kb.Down.Clear(); w.Tick();
        // another application is active: nothing fires, and nothing fires late when coming back with the keys still down
        kb.Photoshop = false;
        kb.Down.Add(0x12); kb.Down.Add(49);
        Check(w.Tick() == null, "not Photoshop: no fire");
        kb.Photoshop = true;
        Check(w.Tick() == null, "back in Photoshop with the keys still down: no late fire");
        kb.Down.Clear(); w.Tick();
        kb.Down.Add(0x12); kb.Down.Add(49);
        Check(w.Tick() == "1", "a new press in Photoshop fires");
        // pressing 1 then 3 without releasing ALT: both fire in turn
        kb.Down.Remove(49); kb.Down.Add(51);
        Check(w.Tick() == "3", "ALT held, switch from 1 to 3");
        // ---- the hook: Shift+F2 = "2 lines" must not ALSO reach Photoshop (where F2 pastes the effect)
        List<Binding> fkeys = KeyWatcher.Parse("2:SHIFT:113;3:ALT:51,99");
        Func<bool> inPs = delegate { return true; };
        Func<bool> notPs = delegate { return false; };
        ComboMatcher m = new ComboMatcher(fkeys, true);
        Press p = m.Handle(113, true, KeyWatcher.SHIFT, inPs);
        Check(p.Command == "2" && p.Swallow, "Shift+F2: command 2 and the key is swallowed");
        p = m.Handle(113, true, KeyWatcher.SHIFT, inPs);
        Check(p.Command == null && p.Swallow, "auto-repeat of the held key: no second command, still swallowed");
        p = m.Handle(113, false, 0, inPs); // Shift was released first, then F2
        Check(p.Swallow && p.Command == null, "the key-up of a swallowed key is swallowed too, whatever the modifiers");
        p = m.Handle(113, false, 0, inPs);
        Check(!p.Swallow, "a key-up that was never swallowed goes through");
        // plain F2 (the user's paste-effect shortcut in Photoshop) is not touched
        p = m.Handle(113, true, 0, inPs);
        Check(!p.Swallow && p.Command == null, "plain F2 passes through to Photoshop untouched");
        p = m.Handle(113, false, 0, inPs);
        Check(!p.Swallow, "and so does its key-up");
        // other combinations of the same key are not ours either
        p = m.Handle(113, true, KeyWatcher.CTRL | KeyWatcher.SHIFT, inPs);
        Check(!p.Swallow && p.Command == null, "Ctrl+Shift+F2 passes through");
        p = m.Handle(113, true, KeyWatcher.ALT, inPs);
        Check(!p.Swallow && p.Command == null, "Alt+F2 passes through");
        // another application: nothing is swallowed, nothing is run
        p = m.Handle(113, true, KeyWatcher.SHIFT, notPs);
        Check(!p.Swallow && p.Command == null, "not Photoshop: the key is left alone");
        p = m.Handle(113, false, KeyWatcher.SHIFT, notPs);
        Check(!p.Swallow, "not Photoshop: key-up left alone");
        // numpad alternative and a second shortcut
        p = m.Handle(99, true, KeyWatcher.ALT, inPs);
        Check(p.Command == "3" && p.Swallow, "Alt+numpad 3");
        m.Handle(99, false, KeyWatcher.ALT, inPs);
        // block off: the command still runs, the key is NOT kept from Photoshop
        ComboMatcher open = new ComboMatcher(fkeys, false);
        p = open.Handle(113, true, KeyWatcher.SHIFT, inPs);
        Check(p.Command == "2" && !p.Swallow, "block off: command runs, key passes through");
        p = open.Handle(113, false, 0, inPs);
        Check(!p.Swallow, "block off: key-up passes");
        // modifier keys themselves are never bound here: they always pass
        p = m.Handle(0x10, true, KeyWatcher.SHIFT, inPs);
        Check(!p.Swallow && p.Command == null, "Shift itself passes through");
        // the photoshop check is only made when a shortcut matches (it is the slow part)
        int asked = 0;
        Func<bool> counting = delegate { asked++; return true; };
        ComboMatcher lazy = new ComboMatcher(fkeys, true);
        lazy.Handle(65, true, 0, counting);
        lazy.Handle(113, true, 0, counting);
        Check(asked == 0, "no Photoshop lookup for keys that are not shortcuts");
        lazy.Handle(113, true, KeyWatcher.SHIFT, counting);
        Check(asked == 1, "one lookup when a shortcut matches");
        Console.WriteLine(fails == 0 ? "KeyWatcher tests passed" : fails + " failures");
        Environment.Exit(fails == 0 ? 0 : 1);
    }
}
