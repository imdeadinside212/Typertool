#target photoshop
// Typertool shortcut: Typertool - 5 lines
// Give this script a key in Photoshop: Edit > Keyboard Shortcuts > Shortcuts For:
// Application Menus > File > Scripts. It only tells the Typertool panel which button to use.
(function () {
    try {
        var lib = new ExternalObject("lib:PlugPlugExternalObject");
        var event = new CSXSEvent();
        event.type = "com.typertool.shortcut";
        event.data = "5";
        event.dispatch();
    } catch (error) {
        alert("Typertool: open the panel first (Window > Extensions > Typertool).\n" + error);
    }
})();
