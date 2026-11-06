#target photoshop
// ============================================================
// Copy Style From Below
// Chọn layer trên cùng -> chạy script:
//  1. Tìm layer "dùng được" gần nhất bên dưới VÀ đè lên layer chọn trên canvas
//     (bỏ qua ẩn / khoá / trống / không chồng lên nhau)
//  2. Copy layer style + mặt nạ trắng đen (layer mask) của nó sang layer đang chọn
//     (mask của B chỉ được chép khi phần đen của nó che pixel của B)
//  3. Nếu layer dưới bị clipping mask:
//     - base là LAYER thường -> dup base (kèm mask) rồi clip layer chọn vào
//     - base là GROUP -> dup group (giữ ruột nếu KEEP_GROUP_CONTENTS = true), bỏ layer chọn VÀO TRONG group
//       (không clip), rồi dup các layer đang clip lên group đó (vd dots-pattern) và clip lại vào group mới
//  4. Nếu layer dưới nằm trong group CÓ effect/mask/blend mode/opacity -> dup group,
//     xoá ruột, đặt tên = tên layer chọn, rồi bỏ layer chọn vào trong.
//     Group "trơn" (Normal / Pass Through, không effect) thì bỏ qua, không dup.
//     Mask của group chỉ được tính khi phần đen của nó che pixel của B; mask chỉ che
//     các layer khác trong group thì bỏ qua.
//  5. Các layer bị clip vào B (nằm ngay trên B) chỉ được copy nếu chúng có phần bị xoá
//     (trong suốt / đen trong mask) nằm trên pixel của B; còn nguyên hoặc chỉ xoá chỗ khác thì bỏ qua.
//  6. A và B đều là TEXT: A lấy màu chữ của B, và size của A được nhân theo tỉ lệ
//     size(B) / size mốc của font B. Size mốc = size được dùng nhiều nhất của font đó trong file
//     (không tính các layer đang chọn). VD mốc 10.67pt, B = 11pt -> A phóng to 11 / 10.67 lần.
//  7. A và B đều là TEXT: nếu B dùng style khác style phổ biến nhất của family B trong file
//     (bold / italic / bold-italic, hoặc weight khác như Medium; bằng font family hay faux đều tính)
//     thì A cũng đổi theo. Thứ tự: kết quả các action font (B / I / BI) -> font cùng family đã cài
//     -> faux bold / faux italic (chỉ khi family không có style đó).
// ============================================================

function sTID(s) { return stringIDToTypeID(s); }
function cTID(s) { return charIDToTypeID(s); }

// Các ID dùng lại nhiều lần -> tạo 1 lần cho nhanh
var ID_PROPERTY = sTID("property");
var ID_LAYER = sTID("layer");
var ID_ORDINAL = sTID("ordinal");
var ID_TARGET = sTID("targetEnum");
var ID_LAYER_ID = sTID("layerID");
var ID_BOUNDS = sTID("bounds");
var ID_LEFT = sTID("left");
var ID_TOP = sTID("top");
var ID_RIGHT = sTID("right");
var ID_BOTTOM = sTID("bottom");
var ID_EFFECTS = sTID("layerEffects");
var ID_HAS_MASK = sTID("hasUserMask");
var ID_GROUP = sTID("group"); // true = layer đang là clipping mask

// true: dup group nền giữ nguyên các layer bên trong (như ảnh mẫu), layer chọn được thêm vào trên cùng
// false: dup group nền rồi xoá sạch ruột, chỉ còn layer chọn
var KEEP_GROUP_CONTENTS = false;

// ---------- Tuỳ chọn: phóng to chữ theo tỉ lệ của layer B ----------
var SCALE_TEXT_BY_B = true;    // false = tắt tính năng
var ONLY_SCALE_UP = true;      // true = chỉ phóng to (B nhỏ hơn mốc thì bỏ qua, A giữ nguyên, KHÔNG BAO GIỜ thu nhỏ)
var COUNT_HIDDEN_TEXT = false; // true = tính cả layer text đang ẩn khi tìm size mốc
var SCALE_TOLERANCE = 0.005;   // lệch dưới 0.5% so với mốc thì coi như bằng mốc
var SCALE_BONUS = 0.10;        // B zoom trong khoảng [MIN, MAX] so với mốc thì A zoom thêm 10% (cộng thẳng vào %)
var SCALE_BONUS_MIN = 0.01;    // từ +1%
var SCALE_BONUS_MAX = 0.30;    // đến +30%; lớn hơn khoảng này thì không cộng thêm
var MANUAL_BASE_SIZE = 0;      // > 0 = size gốc của B do người dùng nhập (Sp / Nar), thay cho size mốc tự thống kê
var FONT_STATS = null;         // font -> { "10.67": số layer dùng size đó }

// ---------- Tuỳ chọn: áp bold / italic / bold-italic (hoặc weight khác) của B lên A ----------
var MATCH_STYLE_FROM_B = true; // false = tắt tính năng
// "" = tự dò: set action nào có cặp "tên" + "tên B" / "tên I" / "tên BI" (vd "448 Speech" + "448 Speech B")
// Ghi đúng tên set action để chỉ dùng set đó (khi đó chạy thử MỌI action trong set)
var FONT_ACTION_SET = "";
var ACTION_SUFFIXES = [" BI", " B", " I"];
var DEBUG_STYLE = false;       // true = hiện 1 bảng thông báo cuối cùng: đọc được gì ở A / B và quyết định ra sao
var DEBUG_LOG = [];
var STYLE_STATS = null;        // family -> { "Style|faux": số layer }
var ACTION_FONTS = null;       // font mà từng action tạo ra (chạy thử trên layer tạm, dò 1 lần khi cần)
var FAMILY_FONTS = {};         // cache: family -> font đã cài trong máy

var ID_FONT_PS = sTID("fontPostScriptName");
var ID_FONT_NAME = sTID("fontName");
var ID_FONT_STYLE = sTID("fontStyleName");
var ID_SYN_BOLD = sTID("syntheticBold");
var ID_SYN_ITALIC = sTID("syntheticItalic");
var ID_ASET = sTID("actionSet");
var ID_ACTION = sTID("action");
var ID_NAME = sTID("name");
var ID_NUMCHILD = sTID("numberOfChildren");

var ID_TEXTKEY = sTID("textKey");
var ID_TSR = sTID("textStyleRange");
var ID_TEXTSTYLE = sTID("textStyle");
var ID_SIZE = sTID("size");
var ID_LEADING = sTID("leading");
var ID_AUTOLEADING = sTID("autoLeading");

function isLocked(l) {
    try { return l.allLocked == true; } catch (e) {}
    return false;
}

// Mở khoá layer / group (mọi loại khoá). Layer clip bị khoá vẫn được xử lý bình thường.
function unlockLayer(l) {
    try { if (l.allLocked) l.allLocked = false; } catch (e) {}
    try { l.pixelsLocked = false; } catch (e) {}
    try { l.positionLocked = false; } catch (e) {}
    try { l.transparentPixelsLocked = false; } catch (e) {}
}

function isEmpty(l) {
    try {
        var b = l.bounds;
        return (b[2].as("px") - b[0].as("px")) <= 0 || (b[3].as("px") - b[1].as("px")) <= 0;
    } catch (e) { return false; }
}

// ID của layer (nếu bản Photoshop hỗ trợ). Không có thì trả null.
function layerId(l) {
    try { var v = l.id; if (typeof v == "number") return v; } catch (e) {}
    return null;
}

// Tạo reference tới layer (và 1 property nếu cần) mà KHÔNG phải chọn layer đó
// -> nhanh hơn nhiều vì Photoshop không phải vẽ lại panel. Không có ID thì mới chọn layer.
function layerRef(layer, prop) {
    var r = new ActionReference();
    if (prop) r.putProperty(ID_PROPERTY, prop);
    var id = layerId(layer);
    if (id !== null) {
        r.putIdentifier(ID_LAYER, id);
    } else {
        app.activeDocument.activeLayer = layer;
        r.putEnumerated(ID_LAYER, ID_ORDINAL, ID_TARGET);
    }
    return r;
}

// Vị trí của layer trong container.layers (-1 nếu không thấy)
function indexInContainer(container, layer) {
    var layers = container.layers;
    var n = layers.length;
    var id = layerId(layer);
    if (id !== null) {
        for (var i = 0; i < n; i++) {
            if (layerId(layers[i]) === id) return i;
        }
        return -1;
    }
    // Dự phòng: đổi tên tạm để nhận diện
    var orig = layer.name;
    var tag = "__T_" + (new Date()).getTime();
    layer.name = tag;
    var k = -1;
    for (var j = 0; j < n; j++) {
        if (layers[j].name == tag) { k = j; break; }
    }
    layer.name = orig;
    return k;
}

function getAncestors(layer) {
    var res = [];
    var p = layer.parent;
    while (p && p.typename == "LayerSet") {
        res.push(p);
        p = p.parent;
    }
    return res; // từ trong ra ngoài
}

function getId(layer) {
    var id = layerId(layer);
    if (id !== null) return id;
    app.activeDocument.activeLayer = layer;
    var r = new ActionReference();
    r.putProperty(ID_PROPERTY, ID_LAYER_ID);
    r.putEnumerated(ID_LAYER, ID_ORDINAL, ID_TARGET);
    return executeActionGet(r).getInteger(ID_LAYER_ID);
}

function stripGroup(g) {
    while (g.layers.length > 0) {
        var c = g.layers[0];
        try { c.allLocked = false; } catch (e) {}
        c.remove();
    }
}

// Bounds của layer theo px: [trái, trên, phải, dưới]
// Dùng bounds của Action Manager: đã tính cả layer style (viền, glow, shadow...)
// nên khớp với thứ nhìn thấy trên canvas. Lỗi thì quay về bounds thường.
function getBounds(l) {
    try {
        var d = executeActionGet(layerRef(l, ID_BOUNDS)).getObjectValue(ID_BOUNDS);
        return [
            d.getUnitDoubleValue(ID_LEFT),
            d.getUnitDoubleValue(ID_TOP),
            d.getUnitDoubleValue(ID_RIGHT),
            d.getUnitDoubleValue(ID_BOTTOM)
        ];
    } catch (e) {
        var b = l.bounds;
        return [b[0].as("px"), b[1].as("px"), b[2].as("px"), b[3].as("px")];
    }
}

// 2 layer có đè lên nhau trên canvas không? (giao nhau thực sự, không chỉ chạm cạnh)
function overlaps(a, b) {
    return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

// Layer / group có layer style (effect) không?
function hasEffects(layer) {
    try {
        var d = executeActionGet(layerRef(layer, ID_EFFECTS));
        if (!d.hasKey(ID_EFFECTS)) return false;
        return d.getObjectValue(ID_EFFECTS).count > 1; // ngoài key "scale"
    } catch (e) { return false; }
}

// Layer có mặt nạ trắng đen (raster mask) không?
function hasMask(layer) {
    var d = executeActionGet(layerRef(layer, ID_HAS_MASK));
    return d.hasKey(ID_HAS_MASK) && d.getBoolean(ID_HAS_MASK);
}

// Group "trơn": không effect, opacity 100, blend mode Normal / Pass Through,
// và không có mask ảnh hưởng tới layer B (maskMatters = false)
// -> không cần dup group, chỉ cần copy layer bên trong
function isPlainGroup(g, maskMatters) {
    try {
        if (g.blendMode != BlendMode.PASSTHROUGH && g.blendMode != BlendMode.NORMAL) return false;
        if (g.opacity < 100) return false;
        if (maskMatters) return false;
        if (hasEffects(g)) return false;
    } catch (e) { return false; }
    return true;
}

// Duyệt theo thứ tự từ trên xuống dưới (đi sâu vào group), bắt đầu từ vị trí "from",
// dừng ngay khi gặp layer hợp lệ đầu tiên đè lên aBounds.
// Group ẩn/khoá thì bỏ qua cả nhánh (con của nó chắc chắn không hợp lệ).
var EXCLUDE = {}; // id các layer đang được chọn (chế độ nhiều layer): không dùng làm nguồn style

function isExcluded(l) {
    for (var k in EXCLUDE) { // chỉ tốn công khi thực sự có layer bị loại
        return EXCLUDE[getId(l)] === true;
    }
    return false;
}

function cs_scan(container, from, parentOk, aBounds) {
    var layers = container.layers;
    var n = layers.length;
    for (var i = from; i < n; i++) {
        var l = layers[i];
        if (l.typename == "LayerSet") {
            var ok = parentOk && l.visible && !isLocked(l);
            if (!ok || isClipped(l)) continue; // group đang bị clip = layer trang trí, không phải nguồn style
            var r = cs_scan(l, 0, ok, aBounds);
            if (r) return r;
        } else {
            if (!parentOk || !l.visible || isLocked(l) || isEmpty(l) || isClipped(l) || isExcluded(l)) continue; // bỏ layer clip (dots-pattern...) và layer đang chọn
            var cb = null;
            try { cb = getBounds(l); } catch (e) {}
            if (cb && overlaps(aBounds, cb)) return l;
        }
    }
    return null;
}

// Tìm layer B bên dưới A mà không phải quét cả tài liệu:
// quét phần còn lại của container chứa A, rồi đi dần ra các group cha.
// Trả về: layer B | null (không có layer hợp lệ) | undefined (không xác định được vị trí A)
function findB(doc, A, aBounds) {
    var anc = getAncestors(A);
    var n = anc.length;

    // okAt[k]: tất cả group từ anc[k] trở ra ngoài đều hiện & không khoá
    var okAt = [];
    var acc = true;
    for (var k = n - 1; k >= 0; k--) {
        acc = acc && anc[k].visible && !isLocked(anc[k]);
        okAt[k] = acc;
    }
    okAt[n] = true;

    for (var c = 0; c <= n; c++) {
        var container = (c < n) ? anc[c] : doc;
        var item = (c == 0) ? A : anc[c - 1];
        var pos = indexInContainer(container, item);
        if (pos < 0) return undefined;
        var r = cs_scan(container, pos + 1, okAt[c], aBounds);
        if (r) return r;
    }
    return null;
}

// Thao tác selection với 1 channel của layer đang active (CHỈ ĐỌC channel, không sửa channel).
// ev: "setd" = thay selection bằng channel | "Intr" = giao selection với channel | "Sbtr" = trừ channel khỏi selection
// chan: "Trsp" = vùng pixel (transparency) | "Msk " = mặt nạ trắng đen
function selOp(ev, chan) {
    var d = new ActionDescriptor();
    var rc = new ActionReference();
    rc.putEnumerated(cTID("Chnl"), cTID("Chnl"), cTID(chan));
    var rs = new ActionReference();
    rs.putProperty(cTID("Chnl"), cTID("fsel"));
    if (ev == "setd") {
        d.putReference(cTID("null"), rs);
        d.putReference(cTID("T   "), rc);
    } else if (ev == "Intr") {
        d.putReference(cTID("null"), rc);
        d.putReference(cTID("With"), rs);
    } else if (ev == "Sbtr") {
        d.putReference(cTID("null"), rc);
        d.putReference(cTID("From"), rs);
    } else {
        throw new Error("selOp: lệnh không hỗ trợ: " + ev);
    }
    executeAction(cTID(ev), d, DialogModes.NO);
}

// Layer C (bị clip vào B) có phần BỊ XOÁ nằm trên pixel của B không?
// "Bị xoá" = chỗ trong suốt (tẩy mất pixel) hoặc chỗ đen của layer mask của C.
// Cách làm: selection = pixel của B, trừ đi phần C còn đang phủ; còn dư dù 1 chút = có chỗ bị xoá.
// C còn nguyên (phủ kín B) hoặc chỉ bị xoá ở chỗ không có pixel của B -> false.
// Lỗi (layer không hỗ trợ) thì coi như có để không bỏ sót.
function hasHoleOver(B, C) {
    var doc = app.activeDocument;
    try {
        var bMask = hasMask(B);
        var cMask = hasMask(C);
        var found = false;
        for (var pass = 0; pass < 2 && !found; pass++) {
            if (pass == 1 && !cMask) break;
            doc.activeLayer = B;
            selOp("setd", "Trsp");
            if (bMask) selOp("Intr", "Msk "); // chỉ tính phần B đang hiện
            doc.activeLayer = C;
            selOp("Sbtr", pass == 0 ? "Trsp" : "Msk ");
            try { doc.selection.bounds; found = true; } catch (e) {} // selection rỗng -> chưa bị xoá
        }
        try { doc.selection.deselect(); } catch (e) {}
        return found;
    } catch (e) {
        try { doc.selection.deselect(); } catch (e2) {}
        return true;
    }
}

// Mask đen của group G có che mất phần nào pixel của B không?
// (selection = pixel của B, trừ đi phần mask của G cho hiện; còn dư dù 1 chút = có che)
// Mask chỉ che các layer khác trong group, không đụng tới B -> false.
// Lỗi thì coi như có che để không bỏ sót.
function maskHidesPartOf(B, G) {
    var doc = app.activeDocument;
    try {
        doc.activeLayer = B;
        selOp("setd", "Trsp");
        if (hasMask(B)) selOp("Intr", "Msk "); // chỉ tính phần B đang hiện
        doc.activeLayer = G;
        selOp("Sbtr", "Msk ");
        var found = false;
        try { doc.selection.bounds; found = true; } catch (e) {}
        try { doc.selection.deselect(); } catch (e) {}
        return found;
    } catch (e) {
        try { doc.selection.deselect(); } catch (e2) {}
        return true;
    }
}

// Mask trắng đen của chính B có che mất phần nào pixel của B không?
// Mask chỉ đen ở chỗ không có pixel của B (ví dụ mask bao quanh hình dạng B) -> false,
// không có lý do gì để chép sang A.
// Lỗi thì coi như có che để không bỏ sót.
function ownMaskHidesPartOfB(B) {
    var doc = app.activeDocument;
    try {
        doc.activeLayer = B;
        selOp("setd", "Trsp");
        selOp("Sbtr", "Msk ");
        var found = false;
        try { doc.selection.bounds; found = true; } catch (e) {}
        try { doc.selection.deselect(); } catch (e) {}
        return found;
    } catch (e) {
        try { doc.selection.deselect(); } catch (e2) {}
        return true;
    }
}

// Xoá layer mask của layer / group (bỏ hẳn, không apply)
function deleteMask(layer) {
    app.activeDocument.activeLayer = layer;
    var d = new ActionDescriptor();
    var r = new ActionReference();
    r.putEnumerated(cTID("Chnl"), cTID("Chnl"), cTID("Msk "));
    d.putReference(cTID("null"), r);
    d.putBoolean(cTID("Aply"), false);
    executeAction(cTID("Dlt "), d, DialogModes.NO);
}

// Copy mặt nạ trắng đen từ layer "from" sang layer "to"
// (load mask thành selection -> tạo mask mới từ selection, giữ nguyên mức xám)
function copyMask(from, to) {
    var doc = app.activeDocument;
    if (!hasMask(from) || hasMask(to)) return;

    doc.activeLayer = from;
    var d = new ActionDescriptor();
    var r = new ActionReference();
    r.putProperty(cTID("Chnl"), cTID("fsel"));
    d.putReference(cTID("null"), r);
    var r2 = new ActionReference();
    r2.putEnumerated(cTID("Chnl"), cTID("Chnl"), cTID("Msk "));
    d.putReference(cTID("T   "), r2);
    executeAction(cTID("setd"), d, DialogModes.NO);

    // Mask đen hoàn toàn -> selection rỗng -> phải tạo mask "hide all"
    var empty = false;
    try { doc.selection.bounds; } catch (e) { empty = true; }

    doc.activeLayer = to;
    var d2 = new ActionDescriptor();
    d2.putClass(cTID("Nw  "), cTID("Chnl"));
    var r3 = new ActionReference();
    r3.putEnumerated(cTID("Chnl"), cTID("Chnl"), cTID("Msk "));
    d2.putReference(cTID("At  "), r3);
    d2.putEnumerated(cTID("Usng"), cTID("UsrM"), empty ? cTID("HdAl") : cTID("RvlS"));
    executeAction(cTID("Mk  "), d2, DialogModes.NO);

    try { doc.selection.deselect(); } catch (e) {}
}



// ---------- Màu chữ (text layer) ----------
// Chỉ dùng Action Manager, KHÔNG đụng vào layer.textItem (DOM) -> không bật hộp thoại "missing fonts"
function isTextLayer(l) {
    try { return l.kind == LayerKind.TEXT; } catch (e) { return false; }
}

function readColorFromStyle(ts) {
    if (ts.hasKey(sTID("color"))) {
        return { desc: ts.getObjectValue(sTID("color")), type: ts.getObjectType(sTID("color")) };
    }
    return null;
}

// Lấy màu chữ của layer text (lấy theo đoạn chữ đầu tiên)
function getTextColor(layer) {
    var d = executeActionGet(layerRef(layer, sTID("textKey")));
    if (!d.hasKey(sTID("textKey"))) return null;
    var tk = d.getObjectValue(sTID("textKey"));
    if (tk.hasKey(sTID("textStyleRange"))) {
        var rl = tk.getList(sTID("textStyleRange"));
        if (rl.count > 0) {
            var r0 = rl.getObjectValue(0);
            if (r0.hasKey(sTID("textStyle"))) {
                var c = readColorFromStyle(r0.getObjectValue(sTID("textStyle")));
                if (c) return c;
            }
        }
    }
    if (tk.hasKey(sTID("textStyle"))) return readColorFromStyle(tk.getObjectValue(sTID("textStyle")));
    return null;
}

// Đặt màu chữ cho toàn bộ layer text, giữ nguyên font và các thuộc tính khác
function setTextColor(layer, c) {
    app.activeDocument.activeLayer = layer;
    var d = new ActionDescriptor();
    var r = new ActionReference();
    r.putProperty(cTID("Prpr"), sTID("textStyle"));
    r.putEnumerated(cTID("TxLr"), ID_ORDINAL, ID_TARGET);
    d.putReference(cTID("null"), r);
    var td = new ActionDescriptor();
    td.putObject(sTID("color"), c.type, c.desc);
    d.putObject(cTID("T   "), sTID("textStyle"), td);
    executeAction(cTID("setd"), d, DialogModes.NO);
}

// ---------- Size chữ (text layer) ----------
// Đọc font + size của layer text (theo đoạn chữ đầu tiên), chỉ dùng Action Manager.
// size = size thực tế (đã nhân hệ số transform nếu layer từng bị scale bằng Free Transform)
// raw  = size lưu trong textStyle, dùng để ghi ngược lại
function getTextInfo(layer) {
    var d = executeActionGet(layerRef(layer, ID_TEXTKEY));
    if (!d.hasKey(ID_TEXTKEY)) return null;
    var tk = d.getObjectValue(ID_TEXTKEY);
    var ts = null;
    if (tk.hasKey(ID_TSR)) {
        // Layer có nhiều đoạn chữ (vd 1 vài từ bold / italic) -> lấy đoạn chiếm nhiều ký tự nhất
        var rl = tk.getList(ID_TSR);
        var bestSpan = -1;
        for (var ri = 0; ri < rl.count; ri++) {
            var rd = rl.getObjectValue(ri);
            if (!rd.hasKey(ID_TEXTSTYLE)) continue;
            var span = 1;
            try { span = rd.getInteger(sTID("to")) - rd.getInteger(sTID("from")); } catch (e) {}
            if (span > bestSpan) { bestSpan = span; ts = rd.getObjectValue(ID_TEXTSTYLE); }
        }
    }
    if (!ts && tk.hasKey(ID_TEXTSTYLE)) ts = tk.getObjectValue(ID_TEXTSTYLE);
    if (!ts || !ts.hasKey(ID_SIZE)) return null;

    var raw = ts.getUnitDoubleValue(ID_SIZE);
    var k = 1;
    try {
        if (tk.hasKey(sTID("transform"))) {
            var tr = tk.getObjectValue(sTID("transform"));
            if (tr.hasKey(sTID("yy"))) k = Math.abs(tr.getDouble(sTID("yy")));
        }
    } catch (e) {}
    if (!(k > 0)) k = 1;

    var font = "";
    if (ts.hasKey(sTID("fontPostScriptName"))) font = ts.getString(sTID("fontPostScriptName"));
    else if (ts.hasKey(sTID("fontName"))) font = ts.getString(sTID("fontName"));

    var auto = ts.hasKey(ID_AUTOLEADING) ? ts.getBoolean(ID_AUTOLEADING) : true;
    var lead = (!auto && ts.hasKey(ID_LEADING)) ? ts.getUnitDoubleValue(ID_LEADING) : null;

    var family = ts.hasKey(ID_FONT_NAME) ? ts.getString(ID_FONT_NAME) : "";
    var style = ts.hasKey(ID_FONT_STYLE) ? ts.getString(ID_FONT_STYLE) : "";
    if (!style && font.indexOf("-") > 0) style = font.substr(font.lastIndexOf("-") + 1).replace(/MT$/, "");
    var fauxB = ts.hasKey(ID_SYN_BOLD) ? ts.getBoolean(ID_SYN_BOLD) : false;
    var fauxI = ts.hasKey(ID_SYN_ITALIC) ? ts.getBoolean(ID_SYN_ITALIC) : false;

    return { font: font, family: family, style: style, fauxB: fauxB, fauxI: fauxI,
             raw: raw, size: raw * k, leading: lead };
}

// Đặt size (và leading nếu đang để thủ công) cho toàn bộ layer text
function setTextSize(layer, raw, leading) {
    app.activeDocument.activeLayer = layer;
    var d = new ActionDescriptor();
    var r = new ActionReference();
    r.putProperty(cTID("Prpr"), ID_TEXTSTYLE);
    r.putEnumerated(cTID("TxLr"), ID_ORDINAL, ID_TARGET);
    d.putReference(cTID("null"), r);
    var td = new ActionDescriptor();
    td.putUnitDouble(ID_SIZE, cTID("#Pnt"), raw);
    if (leading !== null) {
        td.putBoolean(ID_AUTOLEADING, false);
        td.putUnitDouble(ID_LEADING, cTID("#Pnt"), leading);
    }
    d.putObject(cTID("T   "), ID_TEXTSTYLE, td);
    executeAction(cTID("setd"), d, DialogModes.NO);
}

function round2(x) { return Math.round(x * 100) / 100; }

// Duyệt toàn bộ file, đếm số layer text theo (font, size)
function collectTextStats(container, parentVisible, excludeIds, stats) {
    var ls = container.layers;
    for (var i = 0; i < ls.length; i++) {
        var l = ls[i];
        if (l.typename == "LayerSet") {
            collectTextStats(l, parentVisible && l.visible, excludeIds, stats);
            continue;
        }
        if (!isTextLayer(l)) continue;
        if (!COUNT_HIDDEN_TEXT && !(parentVisible && l.visible)) continue;
        if (excludeIds[getId(l)] === true) continue;
        var info = null;
        try { info = getTextInfo(l); } catch (e) {}
        if (!info || !info.font) continue;
        var key = round2(info.size).toFixed(2);
        if (!stats[info.font]) stats[info.font] = {};
        stats[info.font][key] = (stats[info.font][key] || 0) + 1;
        if (STYLE_STATS) {
            mergeFaux(info, l);
            var fk = familyKey(info);
            var sk = styleKey(info);
            if (!STYLE_STATS[fk]) STYLE_STATS[fk] = {};
            STYLE_STATS[fk][sk] = (STYLE_STATS[fk][sk] || 0) + 1;
        }
    }
}

// Thống kê 1 lần trước khi sửa gì. Không tính các layer đang chọn (chúng sắp bị đổi size).
// Không có layer text nào được chọn -> khỏi thống kê (null).
function buildFontStats(doc, sel) {
    var hasText = false;
    var ex = {};
    for (var i = 0; i < sel.length; i++) {
        if (isTextLayer(sel[i])) hasText = true;
        ex[getId(sel[i])] = true;
    }
    if (!hasText) return null;
    var stats = {};
    STYLE_STATS = MATCH_STYLE_FROM_B ? {} : null;
    var oldDlg = app.displayDialogs;
    app.displayDialogs = DialogModes.NO; // đọc textItem (faux) không được bật popup missing font
    try { collectTextStats(doc, true, ex, stats); } catch (e) {}
    app.displayDialogs = oldDlg;
    return stats;
}

// Size mốc của font = size được dùng nhiều nhất; hoà thì lấy size nhỏ hơn
function getBaseSize(font) {
    if (!FONT_STATS || !FONT_STATS[font]) return 0;
    var m = FONT_STATS[font];
    var best = 0, bestCnt = 0;
    for (var k in m) {
        var v = parseFloat(k);
        if (m[k] > bestCnt || (m[k] == bestCnt && v < best)) { best = v; bestCnt = m[k]; }
    }
    return best;
}

// A (text) được nhân size theo tỉ lệ  size(B) / size mốc của font B (+10% nếu B zoom 8%..40%).  Trả về true nếu đã đổi size.
function scaleTextLikeB(A, B) {
    if (!SCALE_TEXT_BY_B || (!FONT_STATS && !(MANUAL_BASE_SIZE > 0))) return false;
    var bi = getTextInfo(B);
    if (!bi || !bi.font) return false;
    var base = MANUAL_BASE_SIZE > 0 ? MANUAL_BASE_SIZE : getBaseSize(bi.font);
    if (!(base > 0)) return false;
    var ratio = bi.size / base;
    if (Math.abs(ratio - 1) < SCALE_TOLERANCE) return false;
    // chỉ phóng to: B bằng hoặc nhỏ hơn mốc thì A giữ nguyên (không bao giờ thu nhỏ)
    if (ONLY_SCALE_UP && ratio < 1) return false;
    // zoom của B từ +1% đến +30% thì A zoom thêm 10% nữa (vd B +20% -> A +30%) để dễ nhận ra khác biệt
    var zoom = ratio - 1;
    if (zoom >= SCALE_BONUS_MIN - 0.00001 && zoom <= SCALE_BONUS_MAX + 0.00001) ratio += SCALE_BONUS;
    if (ONLY_SCALE_UP && ratio < 1) return false; // chốt chặn cuối: tuyệt đối không giảm
    var ai = getTextInfo(A);
    if (!ai) return false;
    setTextSize(A, ai.raw * ratio, ai.leading === null ? null : ai.leading * ratio);
    return true;
}

// ---------- Bold / Italic / Bold-Italic (hoặc weight khác) theo layer B ----------
// Faux bold / faux italic theo DOM (textItem) - dự phòng khi Action Manager không đọc được.
// Gọi khi đã tắt hộp thoại (displayDialogs = NO) để khỏi bật popup missing font.
function domFaux(layer) {
    try {
        var ti = layer.textItem;
        return { b: ti.fauxBold === true, i: ti.fauxItalic === true };
    } catch (e) { return null; }
}

function mergeFaux(info, layer) {
    var d = domFaux(layer);
    if (d) {
        if (d.b) info.fauxB = true;
        if (d.i) info.fauxI = true;
    }
}

function cs_dbg(msg) { if (DEBUG_STYLE) DEBUG_LOG.push(msg); }

function showDebug() {
    if (DEBUG_STYLE && DEBUG_LOG.length > 0) {
        try { alert(DEBUG_LOG.join("\n")); } catch (e) {}
    }
    DEBUG_LOG = [];
}

function fxStr(info) { return (info.fauxB ? "B" : "-") + (info.fauxI ? "I" : "-"); }

function familyKey(info) { return String(info.family || info.font || "").toLowerCase(); }
function styleKey(info) { return (info.style || "") + "|" + (info.fauxB ? 1 : 0) + (info.fauxI ? 1 : 0); }

// Chuẩn hoá style -> { weight: "regular" | "bold" | "medium" | ..., italic: true/false }
// Faux bold / faux italic được tính như bold / italic thật.
function classifyStyle(style, fauxB, fauxI) {
    var s = String(style || "").toLowerCase();
    var italic = /italic|oblique/.test(s);
    var w = s.replace(/italic|oblique/g, "").replace(/[\s_\-]+/g, "");
    if (w == "" || w == "regular" || w == "normal" || w == "roman" || w == "book") w = "regular";
    if (fauxB && w == "regular") w = "bold";
    return { weight: w, italic: italic || !!fauxI };
}

function sameStyle(a, b) { return a.weight == b.weight && a.italic == b.italic; }

function scoreStyleKey(k) {
    var p = k.split("|");
    var f = p.length > 1 ? p[1] : "00";
    var c = classifyStyle(p[0], f.charAt(0) == "1", f.charAt(1) == "1");
    return (c.weight == "regular" ? 0 : 1) + (c.italic ? 1 : 0);
}

// Style phổ biến nhất của 1 family trong file; hoà thì lấy style "thường" hơn
function getBaseStyleKey(fk) {
    var m = STYLE_STATS && STYLE_STATS[fk];
    if (!m) return null;
    var best = null, bestCnt = 0, bestScore = 99;
    for (var k in m) {
        var sc = scoreStyleKey(k);
        if (m[k] > bestCnt || (m[k] == bestCnt && sc < bestScore)) { best = k; bestCnt = m[k]; bestScore = sc; }
    }
    return best;
}

// Đặt font (+ faux bold / italic) cho toàn bộ layer text. KHÔNG đụng size / scale / màu.
function setTextFont(layer, ps, family, style, fauxB, fauxI) {
    app.activeDocument.activeLayer = layer;
    var d = new ActionDescriptor();
    var r = new ActionReference();
    r.putProperty(cTID("Prpr"), ID_TEXTSTYLE);
    r.putEnumerated(cTID("TxLr"), ID_ORDINAL, ID_TARGET);
    d.putReference(cTID("null"), r);
    var td = new ActionDescriptor();
    td.putString(ID_FONT_PS, ps);
    if (family) td.putString(ID_FONT_NAME, family);
    if (style) td.putString(ID_FONT_STYLE, style);
    td.putBoolean(ID_SYN_BOLD, !!fauxB);
    td.putBoolean(ID_SYN_ITALIC, !!fauxI);
    d.putObject(cTID("T   "), ID_TEXTSTYLE, td);
    executeAction(cTID("setd"), d, DialogModes.NO);
    // Kiểm tra lại faux bằng DOM; nếu Action Manager không ăn thì đặt lại bằng DOM
    try {
        var ti = layer.textItem;
        if (ti.fauxBold !== !!fauxB) ti.fauxBold = !!fauxB;
        if (ti.fauxItalic !== !!fauxI) ti.fauxItalic = !!fauxI;
    } catch (e) {}
}

// Font cùng family đã cài trong máy: [{ ps, family, style }]
function getFamilyFonts(family) {
    var key = String(family || "").toLowerCase();
    if (key == "") return [];
    if (FAMILY_FONTS[key]) return FAMILY_FONTS[key];
    var out = [];
    try {
        var fl = app.fonts;
        var n = fl.length;
        for (var i = 0; i < n; i++) {
            var f = fl[i];
            var fam = "";
            try { fam = f.family; } catch (e) {}
            if (String(fam).toLowerCase() != key) continue;
            out.push({ ps: f.postScriptName, family: f.family, style: f.style });
        }
    } catch (e2) {}
    FAMILY_FONTS[key] = out;
    return out;
}

// ---------- Đọc các action font ----------
function readActionSets() {
    var sets = [];
    for (var i = 1; i < 300; i++) {
        var d = null;
        try {
            var ref = new ActionReference();
            ref.putIndex(ID_ASET, i);
            d = executeActionGet(ref);
        } catch (e) { break; }
        var cnt = d.hasKey(ID_NUMCHILD) ? d.getInteger(ID_NUMCHILD) : 0;
        var names = [];
        for (var j = 1; j <= cnt; j++) {
            try {
                var r = new ActionReference();
                r.putIndex(ID_ACTION, j);
                r.putIndex(ID_ASET, i);
                names.push(executeActionGet(r).getString(ID_NAME));
            } catch (e2) {}
        }
        sets.push({ name: d.getString(ID_NAME), actions: names });
    }
    return sets;
}

// Chỉ giữ các action có cặp "tên" + "tên B/I/BI" -> không bao giờ chạy nhầm action lạ
function pickFontActions(names) {
    var has = {};
    for (var i = 0; i < names.length; i++) has[names[i]] = true;
    var out = {};
    for (var k = 0; k < names.length; k++) {
        var n = names[k];
        for (var s = 0; s < ACTION_SUFFIXES.length; s++) {
            var suf = ACTION_SUFFIXES[s];
            if (n.length > suf.length && n.substr(n.length - suf.length) == suf) {
                var base = n.substr(0, n.length - suf.length);
                if (has[base]) { out[base] = true; out[n] = true; }
            }
        }
    }
    var list = [];
    for (var key in out) list.push(key);
    return list;
}

// Tách tên action: "448 Speech BI" -> { base: "448 Speech", suffix: " BI" }; không có hậu tố -> suffix ""
function splitActionName(n) {
    for (var s = 0; s < ACTION_SUFFIXES.length; s++) {
        var suf = ACTION_SUFFIXES[s];
        if (n.length > suf.length && n.substr(n.length - suf.length) == suf) {
            return { base: n.substr(0, n.length - suf.length), suffix: suf };
        }
    }
    return { base: n, suffix: "" };
}

// Chạy thử từng action font trên 1 layer text TẠM rồi đọc font nó tạo ra (family, style, faux).
// Layer thật không bị chạy action -> size / scale của A không bị ghi đè. Dò 1 lần, xong xoá layer tạm.
function getActionFonts() {
    if (ACTION_FONTS) return ACTION_FONTS;
    ACTION_FONTS = [];
    var doc = app.activeDocument;
    var jobs = [];
    try {
        var sets = readActionSets();
        for (var i = 0; i < sets.length; i++) {
            var names;
            if (FONT_ACTION_SET != "") {
                if (sets[i].name != FONT_ACTION_SET) continue;
                names = sets[i].actions;
            } else {
                names = pickFontActions(sets[i].actions);
            }
            for (var j = 0; j < names.length; j++) {
                var sp = splitActionName(names[j]);
                jobs.push({ set: sets[i].name, name: names[j], group: sets[i].name + "::" + sp.base, suffix: sp.suffix });
            }
        }
    } catch (e) {}
    if (jobs.length == 0) return ACTION_FONTS;

    var oldDlg = app.displayDialogs;
    var keep = doc.activeLayer;
    // Mỗi action chạy trên 1 layer tạm MỚI (không dùng chung): action "B" chỉ bật bold, không tắt italic,
    // nên nếu dùng chung layer thì italic của action "I" chạy trước đó bị dính sang kết quả của "B".
    // Action biến thể (B / I / BI) được chạy SAU action gốc của nhóm (trạng thái Regular, như khi dùng tay).
    var baseOf = {};
    for (var bi0 = 0; bi0 < jobs.length; bi0++) if (jobs[bi0].suffix === "") baseOf[jobs[bi0].group] = jobs[bi0];
    app.displayDialogs = DialogModes.NO;
    for (var k = 0; k < jobs.length; k++) {
        var scratch = null;
        try {
            scratch = doc.artLayers.add();
            scratch.kind = LayerKind.TEXT;
            scratch.textItem.contents = "x";
            doc.activeLayer = scratch;
            var bj = baseOf[jobs[k].group];
            if (jobs[k].suffix !== "" && bj) {
                app.doAction(bj.name, bj.set);
                doc.activeLayer = scratch;
            }
            app.doAction(jobs[k].name, jobs[k].set);
            doc.activeLayer = scratch;
            var info = getTextInfo(scratch);
            if (info && info.font) {
                mergeFaux(info, scratch);
                info.name = jobs[k].name;
                info.group = jobs[k].group;
                info.suffix = jobs[k].suffix;
                ACTION_FONTS.push(info);
            }
        } catch (e2) {}
        try { if (scratch) scratch.remove(); } catch (e4) {}
    }
    app.displayDialogs = oldDlg;
    try { doc.activeLayer = keep; } catch (e5) {}
    return ACTION_FONTS;
}

// Nhóm action "group" có phải nhóm font của A không? (bất kỳ action nào trong nhóm cho font trùng A)
function actionGroupIsFontOfA(acts, group, ai, fk) {
    for (var i = 0; i < acts.length; i++) {
        var m = acts[i];
        if (m.group != group) continue;
        if (familyKey(m) == fk) return true;
        if (m.font && ai.font && m.font == ai.font) return true;
    }
    return false;
}

// Đổi A sang style "target". Thứ tự: action font -> font cùng family đã cài -> faux
function setStyleVariant(A, ai, target) {
    var fk = familyKey(ai);

    // 1. ACTION font (ưu tiên cao nhất, kể cả khi action dùng faux).
    //    a) Tìm NHÓM action ("448 Speech" + " B" / " I" / " BI") mà font của nó là font của A:
    //       trùng family HOẶC trùng tên PostScript HOẶC trùng tên gốc của font.
    //    b) Trong nhóm đó lấy action theo hậu tố: bold+italic -> BI, bold -> B, italic -> I, thường -> action gốc.
    //       Chọn theo TÊN action nên không phụ thuộc việc đọc lại faux có chính xác hay không.
    var acts = getActionFonts();
    var wantSuf = null;
    if (target.weight == "bold") wantSuf = target.italic ? " BI" : " B";
    else if (target.weight == "regular") wantSuf = target.italic ? " I" : "";
    if (wantSuf !== null) {
        for (var i = 0; i < acts.length; i++) {
            var a = acts[i];
            if (a.suffix !== wantSuf) continue;
            if (!actionGroupIsFontOfA(acts, a.group, ai, fk)) continue;
            setTextFont(A, a.font, a.family, a.style, a.fauxB, a.fauxI);
            cs_dbg("  [action] " + a.name + " -> " + a.font + " / " + a.style + " / faux " + fxStr(a));
            return true;
        }
    }
    // Weight khác (Medium...): dò theo kết quả của action nếu có
    for (var i2 = 0; i2 < acts.length; i2++) {
        var a2 = acts[i2];
        if (familyKey(a2) != fk) continue;
        if (sameStyle(classifyStyle(a2.style, a2.fauxB, a2.fauxI), target)) {
            setTextFont(A, a2.font, a2.family, a2.style, a2.fauxB, a2.fauxI);
            cs_dbg("  [action] " + a2.name + " -> " + a2.font + " / " + a2.style + " / faux " + fxStr(a2));
            return true;
        }
    }

    // 2. Font cùng family đã cài, đúng style (không cần faux)
    var fonts = getFamilyFonts(ai.family);
    for (var j = 0; j < fonts.length; j++) {
        if (sameStyle(classifyStyle(fonts[j].style, false, false), target)) {
            setTextFont(A, fonts[j].ps, fonts[j].family, fonts[j].style, false, false);
            cs_dbg("  [family] " + fonts[j].ps);
            return true;
        }
    }

    // 3. Faux: chỉ cho bold / italic. Chọn font nền cần ít faux nhất
    //    (kể cả font hiện tại của A đã bỏ faux, phòng khi font đó không có trong danh sách font cài)
    if (target.weight != "regular" && target.weight != "bold") return false;
    var cands = [];
    for (var m = 0; m < fonts.length; m++) {
        cands.push({ ps: fonts[m].ps, family: fonts[m].family, style: fonts[m].style,
                     c: classifyStyle(fonts[m].style, false, false) });
    }
    cands.push({ ps: ai.font, family: ai.family, style: ai.style, c: classifyStyle(ai.style, false, false) });

    var best = null, bestNeed = 99, bestB = false, bestI = false;
    for (var n = 0; n < cands.length; n++) {
        var c = cands[n].c;
        if (c.weight != "regular" && c.weight != "bold") continue;
        if (c.weight == "bold" && target.weight != "bold") continue; // faux không gỡ được bold thật
        if (c.italic && !target.italic) continue;
        var needB = (target.weight == "bold" && c.weight != "bold");
        var needI = (target.italic && !c.italic);
        var need = (needB ? 1 : 0) + (needI ? 1 : 0);
        if (need < bestNeed) { best = cands[n]; bestNeed = need; bestB = needB; bestI = needI; }
    }
    if (!best || !best.ps) return false;
    setTextFont(A, best.ps, best.family, best.style, bestB, bestI);
    cs_dbg("  [faux] " + best.ps + " B=" + bestB + " I=" + bestI);
    return true;
}

// Mô tả style: weight (tên weight thật của font), bold (bold thật HOẶC faux), italic (italic thật HOẶC faux)
function describeStyle(style, fauxB, fauxI) {
    var c = classifyStyle(style, false, false);
    return { weight: c.weight, bold: /bold|black|heavy/.test(c.weight) || !!fauxB, italic: c.italic || !!fauxI };
}

function parseStyleKey(k) {
    var p = k.split("|");
    var f = p.length > 1 ? p[1] : "00";
    return describeStyle(p[0], f.charAt(0) == "1", f.charAt(1) == "1");
}

// Style A cần có = phần B CÓ THÊM so với style mốc của family B (A "thường" = Regular, đứng thẳng).
// VD mốc là Medium + faux italic, B là Medium + faux italic + faux bold -> A chỉ cần bold (không italic).
// B nhẹ hơn / bằng mốc, không thêm gì -> null (A giữ nguyên).
function styleTargetForA(b, base) {
    var wantBold = b.bold && !base.bold;
    var wantItalic = b.italic && !base.italic;
    var wantWeight = null;
    if (!b.bold && !base.bold && b.weight != "regular" && b.weight != base.weight) wantWeight = b.weight;
    if (!wantBold && !wantItalic && !wantWeight) return null;
    return { weight: wantBold ? "bold" : (wantWeight || "regular"), italic: wantItalic };
}

// B dùng style khác style phổ biến nhất của family B trong file -> A đổi theo phần khác đó. Trả về true nếu đã đổi.
function applyStyleLikeB(A, B) {
    if (!MATCH_STYLE_FROM_B || !STYLE_STATS) return false;
    var bi = getTextInfo(B);
    var ai = getTextInfo(A);
    if (!bi || !ai || !ai.font) return false;
    mergeFaux(bi, B); // faux bold / italic của B (AM + DOM)
    mergeFaux(ai, A);
    var base = getBaseStyleKey(familyKey(bi));
    var cur = classifyStyle(ai.style, ai.fauxB, ai.fauxI);
    var log = "A: " + ai.font + " / " + ai.style + " / faux " + fxStr(ai) +
              "  |  B: " + bi.font + " / " + bi.style + " / faux " + fxStr(bi) +
              "  |  mốc family B: " + base;
    if (base === null || base == styleKey(bi)) { cs_dbg(log + "  => B đúng style mốc, giữ nguyên A"); return false; }
    var target = styleTargetForA(describeStyle(bi.style, bi.fauxB, bi.fauxI), parseStyleKey(base));
    if (!target) { cs_dbg(log + "  => B không thêm bold / italic / weight so với mốc, giữ nguyên A"); return false; }
    log += "  |  A cần: " + target.weight + (target.italic ? "+italic" : "");
    if (sameStyle(cur, target)) { cs_dbg(log + "  => A đã đúng style"); return false; }
    var ok = setStyleVariant(A, ai, target);
    cs_dbg(log + (ok ? "  => đã đổi A" : "  => không có font / faux phù hợp, giữ nguyên A"));
    return ok;
}

// ---------- Auto center: A (text) nằm giữa B (text) ----------
var AUTO_CENTER_TEXT = false;  // panel ghi đè mỗi lần bấm nút
var CENTER_OK = false;         // true khi bật tính năng VÀ mọi layer đang chọn đều là text

// Bounds KHÔNG tính layer style (shadow / stroke / glow lệch 1 phía sẽ làm căn sai) - [trái, trên, phải, dưới] px
function getBoundsNoFx(l) {
    try {
        var d = executeActionGet(layerRef(l, sTID("boundsNoEffects"))).getObjectValue(sTID("boundsNoEffects"));
        return [d.getUnitDoubleValue(ID_LEFT), d.getUnitDoubleValue(ID_TOP),
                d.getUnitDoubleValue(ID_RIGHT), d.getUnitDoubleValue(ID_BOTTOM)];
    } catch (e) {
        var b = l.bounds;
        return [b[0].as("px"), b[1].as("px"), b[2].as("px"), b[3].as("px")];
    }
}

// Dời CHỈ layer A sao cho tâm của A trùng tâm của B. B tuyệt đối không bị đụng tới.
// Gọi sau khi A đã đổi size / font xong (kích thước cuối cùng của A mới đúng).
function centerOnB(A, B) {
    var ab = getBoundsNoFx(A);
    var bb = getBoundsNoFx(B);
    var dx = (bb[0] + bb[2]) / 2 - (ab[0] + ab[2]) / 2;
    var dy = (bb[1] + bb[3]) / 2 - (ab[1] + ab[3]) / 2;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return false;
    A.translate(new UnitValue(dx, "px"), new UnitValue(dy, "px"));
    cs_dbg("  [center] dx=" + round2(dx) + " dy=" + round2(dy));
    return true;
}

// ---------- Clipping mask ----------
// Layer / group có đang bị clip vào layer bên dưới không?
// (ArtLayer.grouped không có trên LayerSet -> dùng Action Manager cho cả hai)
function isClipped(layer) {
    try {
        var d = executeActionGet(layerRef(layer, ID_GROUP));
        if (d.hasKey(ID_GROUP)) return d.getBoolean(ID_GROUP);
    } catch (e) {}
    try { return layer.grouped == true; } catch (e2) {}
    return false;
}

function setClipped(layer, want) {
    if (isClipped(layer) == want) return;
    app.activeDocument.activeLayer = layer;
    if (want) {
        try { layer.grouped = true; return; } catch (e) {}
        var d = new ActionDescriptor();
        var r = new ActionReference();
        r.putEnumerated(ID_LAYER, ID_ORDINAL, ID_TARGET);
        d.putReference(cTID("null"), r);
        executeAction(sTID("groupEvent"), d, DialogModes.NO);
    } else {
        try { layer.grouped = false; return; } catch (e) {}
        var d2 = new ActionDescriptor();
        var r2 = new ActionReference();
        r2.putEnumerated(ID_LAYER, ID_ORDINAL, ID_TARGET);
        d2.putReference(cTID("null"), r2);
        executeAction(sTID("ungroup"), d2, DialogModes.NO);
    }
}

// Chuỗi clipping chứa layer: base (nền, layer không bị clip nằm dưới cùng)
// và clips (các layer bị clip lên base, thứ tự từ dưới lên trên).
// Layer không bị clip: base = chính nó, clips = các layer clip trực tiếp lên nó.
function getChain(layer) {
    var cont = layer.parent;
    var ls = cont.layers;
    var n = ls.length;
    var k = indexInContainer(cont, layer);
    if (k < 0) return null;
    var bi = k;
    while (bi + 1 < n && isClipped(ls[bi])) bi++;
    var clips = [];
    for (var u = bi - 1; u >= 0; u--) {
        if (!isClipped(ls[u])) break;
        clips.push(ls[u]);
    }
    return { base: ls[bi], clips: clips };
}

// Duplicate THẲNG tới vị trí mong muốn.
// KHÔNG dùng duplicate() trơn rồi move: bản dup chen vào giữa chuỗi clipping của layer gốc
// làm layer gốc (vd dots-pattern) bị mất clipping mask.
function dupAt(src, rel, place) {
    var d = null;
    try { d = src.duplicate(rel, place); } catch (e) { d = null; }
    if (!d) {
        d = src.duplicate();
        d.move(rel, place);
    }
    return d;
}

// Không hiện popup: gặp lỗi / không có gì để copy thì chỉ phát tiếng ting của hệ thống
var SILENT = false; // nhiều layer: bỏ qua im lặng, không ting

function cs_notify() {
    if (SILENT) return;
    try { app.beep(); return; } catch (e) {}
    try { beep(); } catch (e2) {}
}

// ---------- Layer đang chọn ----------
function findLayerById(container, id) {
    var ls = container.layers;
    for (var i = 0; i < ls.length; i++) {
        var l = ls[i];
        if (layerId(l) === id) return l;
        if (l.typename == "LayerSet") {
            var r = findLayerById(l, id);
            if (r) return r;
        }
    }
    return null;
}

// Danh sách layer đang chọn, thứ tự từ dưới lên trên. Lỗi -> chỉ trả về layer active.
function getSelectedLayers(doc) {
    var out = [];
    try {
        var ref = new ActionReference();
        ref.putEnumerated(cTID("Dcmn"), ID_ORDINAL, ID_TARGET);
        var d = executeActionGet(ref);
        if (!d.hasKey(sTID("targetLayers"))) return [doc.activeLayer];
        var list = d.getList(sTID("targetLayers"));
        var hasBg = false;
        try { var bg = doc.backgroundLayer; hasBg = true; } catch (e) {}
        var items = [];
        for (var i = 0; i < list.count; i++) {
            var idx = list.getReference(i).getIndex();
            if (!hasBg) idx += 1;
            var r = new ActionReference();
            r.putProperty(ID_PROPERTY, ID_LAYER_ID);
            r.putIndex(ID_LAYER, idx);
            items.push({ idx: idx, id: executeActionGet(r).getInteger(ID_LAYER_ID) });
        }
        items.sort(function (a, b) { return a.idx - b.idx; });
        for (var k = 0; k < items.length; k++) {
            var L = findLayerById(doc, items[k].id);
            if (L) out.push({ id: items[k].id, layer: L });
        }
    } catch (e) { return [doc.activeLayer]; }
    if (out.length == 0) return [doc.activeLayer];
    var res = [];
    for (var m = 0; m < out.length; m++) res.push(out[m].layer);
    return res;
}

function cs_run() {
    if (app.documents.length == 0) { cs_notify(); return; }
    var doc = app.activeDocument;
    var sel = getSelectedLayers(doc);

    // Auto center chỉ chạy khi TẤT CẢ layer đang chọn là text (B cũng phải là text, kiểm tra ở processLayer)
    CENTER_OK = AUTO_CENTER_TEXT;
    for (var ci = 0; ci < sel.length && CENTER_OK; ci++) if (!isTextLayer(sel[ci])) CENTER_OK = false;

    // Thống kê size mốc của từng font (1 lần, trước khi dup / sửa bất cứ thứ gì)
    FONT_STATS = null;
    STYLE_STATS = null;
    ACTION_FONTS = null;  // panel giữ biến toàn cục giữa các lần bấm -> dò lại action mỗi lần
    FAMILY_FONTS = {};
    if (SCALE_TEXT_BY_B || MATCH_STYLE_FROM_B) {
        try { FONT_STATS = buildFontStats(doc, sel); } catch (e) { FONT_STATS = null; }
    }

    if (sel.length <= 1) {
        SILENT = false;
        EXCLUDE = {};
        processLayer(doc, doc.activeLayer);
        showDebug();
        return;
    }

    // Nhiều layer: mỗi layer copy style từ layer nằm dưới NÓ, layer nào không có gì để copy thì bỏ qua im lặng
    SILENT = true;
    EXCLUDE = {};
    for (var i = 0; i < sel.length; i++) EXCLUDE[getId(sel[i])] = true;
    for (var j = 0; j < sel.length; j++) {
        try { processLayer(doc, sel[j]); } catch (e) {}
    }
    SILENT = false;
    EXCLUDE = {};
    showDebug();
}

function processLayer(doc, A) {

    if (A.typename == "LayerSet") {
        cs_notify();
        return;
    }

    // --- 1. Tìm layer B bên dưới A: gần nhất, hợp lệ, ĐÈ LÊN A trên canvas ---
    var aBounds = getBounds(A);
    var B = findB(doc, A, aBounds);

    if (B === undefined) { cs_notify(); return; }
    if (!B) { cs_notify(); return; }

    // --- 2. Copy & paste layer style ---
    // B không có effect thì vẫn đi tiếp (B có thể chỉ nằm trong group có effect / mask / clip)
    var did = false; // đã copy được thứ gì từ B chưa
    try {
        doc.activeLayer = B;
        executeAction(sTID("copyEffects"), undefined, DialogModes.NO);
        doc.activeLayer = A;
        executeAction(sTID("pasteEffects"), undefined, DialogModes.NO);
        did = true;
    } catch (e) {}

    // --- 2b. Copy mặt nạ trắng đen của B (nếu có) sang A ---
    try {
        // Chỉ chép mask của B khi phần đen của nó thực sự che pixel của B
        if (hasMask(B) && ownMaskHidesPartOfB(B)) { copyMask(B, A); did = true; }
    } catch (e) { cs_notify(); }
    doc.activeLayer = A;


    // --- 2c. Cả A và B đều là text -> A lấy màu chữ của B ---
    if (isTextLayer(A) && isTextLayer(B)) {
        var oldDlg = app.displayDialogs;
        app.displayDialogs = DialogModes.NO; // phòng hộp thoại missing font
        try {
            var tc = getTextColor(B);
            if (tc) { setTextColor(A, tc); did = true; }
        } catch (e) {}
        // A phóng to / thu nhỏ theo tỉ lệ size của B so với size mốc của font B
        try { if (scaleTextLikeB(A, B)) did = true; } catch (e) {}
        // A đổi bold / italic / weight theo B (so với style phổ biến nhất của family B)
        try { if (applyStyleLikeB(A, B)) did = true; } catch (e) {}
        // A tự căn giữa B (sau khi size / font của A đã chốt). Chỉ dời A, không đụng B.
        try { if (CENTER_OK && centerOnB(A, B)) did = true; } catch (e) {}
        app.displayDialogs = oldDlg;
        doc.activeLayer = A;
    }

    // --- 3. Chuỗi clipping của B: base (nền) + các layer clip lên base ---
    var chain = getChain(B);
    if (!chain) { cs_notify(); return; }
    var bClipped = isClipped(B);
    var base = chain.base;
    var groupBase = bClipped && base.typename == "LayerSet"; // B clip lên 1 GROUP
    var layerBase = bClipped && !groupBase;                  // B clip lên 1 layer thường

    // Layer cần dup rồi clip lại:
    //  - base là group: toàn bộ layer đang clip lên group (gồm cả B, vd dots-pattern)
    //  - B không bị clip: chỉ các layer clip lên B mà có phần bị xoá nằm trên pixel của B
    var clipSources = [];
    for (var u = 0; u < chain.clips.length; u++) {
        var C = chain.clips[u];
        if (!C.visible) continue;
        unlockLayer(C); // layer clip bị khoá -> mở khoá rồi làm tiếp
        if (groupBase) clipSources.push(C);
        else if (!bClipped && hasHoleOver(B, C)) clipSources.push(C);
    }
    doc.activeLayer = A;

    // base là layer thường -> dup base để A clip vào
    var baseDup = null;
    if (layerBase) {
        baseDup = dupAt(base, A, ElementPlacement.PLACEBEFORE);
        baseDup.name = base.name;
    }

    // --- 4. Chuẩn bị các group wrapper (bỏ những group A đã nằm sẵn trong) ---
    var aIds = [];
    var aAnc = getAncestors(A);
    for (var x = 0; x < aAnc.length; x++) aIds.push(getId(aAnc[x]));

    var wrappers = [];     // từ trong ra ngoài
    var placeholders = [];
    var wrapperClips = []; // layer đang clip lên group GỐC của từng wrapper (song song với wrappers)

    // Trong cùng: group nền mà B đang bị clip vào -> A nằm TRONG group này, không clip
    if (groupBase) {
        var gd = dupAt(base, A, ElementPlacement.PLACEBEFORE);
        if (!KEEP_GROUP_CONTENTS) stripGroup(gd);
        var ph0 = gd.artLayers.add(); // layer tạm làm mốc để chèn A vào trên cùng group
        ph0.name = "__placeholder__";
        wrappers.push(gd);
        placeholders.push(ph0);
        wrapperClips.push([]);
    }

    var bAnc = getAncestors(B);
    for (var y = 0; y < bAnc.length; y++) {
        // Mask của group chỉ tính khi phần đen của nó che pixel của B
        var gHasMask = false;
        var maskHitsB = false;
        try {
            gHasMask = hasMask(bAnc[y]);
            if (gHasMask) maskHitsB = maskHidesPartOf(B, bAnc[y]);
        } catch (e) { maskHitsB = gHasMask; }
        if (isPlainGroup(bAnc[y], maskHitsB)) continue; // group trơn -> bỏ qua, không dup
        var gid = getId(bAnc[y]);
        var shared = false;
        for (var z = 0; z < aIds.length; z++) if (aIds[z] == gid) { shared = true; break; }
        if (shared) continue;
        // Layer clip lên group gốc (vd dots-pattern): ghi lại TRƯỚC khi dup / di chuyển gì
        var wc = [];
        try {
            if (!isClipped(bAnc[y])) {
                var wch = getChain(bAnc[y]);
                if (wch) for (var wi = 0; wi < wch.clips.length; wi++) {
                    if (wch.clips[wi].visible) {
                        unlockLayer(wch.clips[wi]); // bị khoá -> mở khoá rồi làm tiếp
                        wc.push(wch.clips[wi]);
                    }
                }
            }
        } catch (e) {}
        var w = dupAt(bAnc[y], A, ElementPlacement.PLACEBEFORE);
        // Group phải dup vì lý do khác (effect, blend...) nhưng mask không đụng B -> bỏ mask khỏi bản dup
        if (gHasMask && !maskHitsB) { try { deleteMask(w); } catch (e) {} }
        stripGroup(w);
        w.name = A.name;
        // PLACEINSIDE báo lỗi 1320 với group rỗng -> thêm layer tạm làm mốc
        var ph = w.artLayers.add();
        ph.name = "__placeholder__";
        wrappers.push(w);
        placeholders.push(ph);
        wrapperClips.push(wc);
    }

    // --- 5. Ráp cấu trúc ---
    if (wrappers.length > 0) {
        wrappers[0].move(A, ElementPlacement.PLACEBEFORE);
        if (baseDup) {
            baseDup.move(placeholders[0], ElementPlacement.PLACEBEFORE);
            A.move(baseDup, ElementPlacement.PLACEBEFORE); // A nằm trên base
        } else {
            A.move(placeholders[0], ElementPlacement.PLACEBEFORE);
        }
        for (var n = 1; n < wrappers.length; n++) {
            wrappers[n].move(wrappers[n - 1], ElementPlacement.PLACEBEFORE);
            wrappers[n - 1].move(placeholders[n], ElementPlacement.PLACEBEFORE);
        }
        for (var p = 0; p < placeholders.length; p++) {
            try { placeholders[p].remove(); } catch (e) {}
        }
    } else if (baseDup) {
        baseDup.move(A, ElementPlacement.PLACEAFTER);
    }

    // A clip vào base layer (chỉ khi base là layer thường)
    if (layerBase) setClipped(A, true);

    // Dup các layer clip (vd dots-pattern) đặt ngay trên nền mới rồi clip lại:
    //  - nền mới là group dup (groupBase) -> neo vào group đó
    //  - còn lại -> neo vào A
    var anchor = groupBase ? wrappers[0] : A;
    for (var v = 0; v < clipSources.length; v++) {
        var dd = dupAt(clipSources[v], anchor, ElementPlacement.PLACEBEFORE);
        setClipped(dd, true);
        anchor = dd;
    }

    // Dup layer clip của từng group gốc, clip vào wrapper tương ứng (giữ nguyên effect riêng của chúng)
    for (var wk = 0; wk < wrappers.length; wk++) {
        var wAnchor = wrappers[wk];
        for (var wj = 0; wj < wrapperClips[wk].length; wj++) {
            var wd = dupAt(wrapperClips[wk][wj], wAnchor, ElementPlacement.PLACEBEFORE);
            setClipped(wd, true);
            wAnchor = wd;
        }
    }

    // --- 6. Khôi phục clipping của các layer GỐC (dots-pattern...) ---
    // Photoshop có thể tự gỡ clip của layer gốc khi dup / move base của chúng.
    // Chuỗi clip gốc đã lưu ở bước 3 -> kiểm tra lại, layer nào mất clip thì clip lại.
    var restore = chain.clips.slice(0);
    for (var rk = 0; rk < wrapperClips.length; rk++) restore = restore.concat(wrapperClips[rk]);
    for (var q = 0; q < restore.length; q++) {
        try { setClipped(restore[q], true); } catch (e) {}
    }

    // Không copy được effect / mask / màu chữ và cũng không có group, clip nào để dựng lại -> báo bằng tiếng ting
    if (!did && wrappers.length == 0 && !baseDup && clipSources.length == 0) cs_notify();

    doc.activeLayer = A;
}

// ---------- Điểm vào cho panel ----------
// Panel gọi: copyStylePanelRun(matchStyle, scaleSize, autoCenter, manualBase)
//   manualBase: > 0 = size gốc của B (ô Sp / Nar đang chọn), 0 = tự thống kê như cũ
//   matchStyle: true = copy bold/italic của B    | false = bỏ qua
//   scaleSize : true = chỉnh size A theo tỉ lệ B | false = bỏ qua
//   autoCenter: true = căn A vào giữa B (khi A và B đều là text) | false = bỏ qua
function copyStylePanelRun(matchStyle, scaleSize, autoCenter, manualBase) {
    var mb = parseFloat(manualBase);
    MANUAL_BASE_SIZE = (mb > 0) ? mb : 0;
    MATCH_STYLE_FROM_B = (matchStyle === true || matchStyle === "true");
    SCALE_TEXT_BY_B = (scaleSize === undefined) ? SCALE_TEXT_BY_B : (scaleSize === true || scaleSize === "true");
    AUTO_CENTER_TEXT = (autoCenter === true || autoCenter === "true");
    if (app.documents.length > 0) {
        app.activeDocument.suspendHistory("Copy Style From Below", "cs_run()");
    } else {
        cs_notify();
    }
    return "ok";
}
