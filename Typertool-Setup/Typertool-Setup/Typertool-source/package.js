// Assembles dist/Typertool-Setup: the extension folder, the installers and the readme
const fs = require("fs");
const path = require("path");

const root = __dirname;
const setup = path.join(root, "dist", "Typertool-Setup");
const extension = path.join(root, "dist", "Typertool");
fs.rmSync(setup, { recursive: true, force: true });
fs.mkdirSync(setup, { recursive: true });

// host.jsx: the host code of TypeR (text, selection, layers, image masks), the
// one of Copy Style and the fast apply/centre routine of this panel, one after
// the other in the same ExtendScript scope
// (host/typer_base.jsx is the TypeR host; TYPER_HOST can point to another copy)
const typerHost = fs.readFileSync(process.env.TYPER_HOST || path.join(root, "host/typer_base.jsx"), "utf8");
const strip = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/^#target[^\r\n]*\r?\n/, "");
fs.writeFileSync(
  path.join(extension, "jsx/host.jsx"),
  typerHost + "\n;\n" + strip("host/copy_style.jsx") + "\n;\n" + strip("host/typertool_fast.jsx")
);

fs.copyFileSync(path.join(root, "ext/manifest.xml"), path.join(extension, "CSXS/manifest.xml"));
fs.cpSync(extension, path.join(setup, "Typertool"), { recursive: true });
for (const file of ["install_win.cmd", "install_mac.command", "uninstall_win.cmd", "README.txt"]) {
  fs.copyFileSync(path.join(root, "ext", file), path.join(setup, file));
}
// The shortcut scripts: one per line count + "best". Assigned to keys in Photoshop
// (Edit > Keyboard Shortcuts > Application Menus > File > Scripts), each one only sends the
// panel a message (CSXSEvent), so nothing has to poll Photoshop for the keyboard.
const scriptsDir = path.join(setup, "Scripts");
fs.mkdirSync(scriptsDir, { recursive: true });
const shortcutScript = (command, label) => [
  "#target photoshop",
  "// Typertool shortcut: " + label,
  "// Give this script a key in Photoshop: Edit > Keyboard Shortcuts > Shortcuts For:",
  "// Application Menus > File > Scripts. It only tells the Typertool panel which button to use.",
  "(function () {",
  "    try {",
  '        var lib = new ExternalObject("lib:PlugPlugExternalObject");',
  "        var event = new CSXSEvent();",
  '        event.type = "com.typertool.shortcut";',
  '        event.data = "' + command + '";',
  "        event.dispatch();",
  "    } catch (error) {",
  '        alert("Typertool: open the panel first (Window > Extensions > Typertool).\\n" + error);',
  "    }",
  "})();",
  "",
].join("\r\n");
const shortcuts = [["best", "Typertool - Best"]];
for (let n = 1; n <= 14; n++) shortcuts.push([String(n), "Typertool - " + n + (n === 1 ? " line" : " lines")]);
shortcuts.push(["fit", "Typertool - Fit"]);
shortcuts.forEach(([command, label]) => fs.writeFileSync(path.join(scriptsDir, label + ".jsx"), shortcutScript(command, label)));
console.log("setup assembled");
