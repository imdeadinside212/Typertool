// ============================================================
// Typertool: apply a line-break option AND centre the layer in ONE host call
//
// The stock flow was: write the text (one history state) -> ask for the layer
// box -> save the selection to a channel, move the layer, reload the selection
// (a second history state) -> re-read the whole layer. Five round trips and a
// lot of document work for every click.
//
// This version does the same job in a single call and a single history state:
//   1. writes the text with the stock TypeR routine (_setTextShapeRText),
//   2. moves ONLY the layer so its centre lands on the target,
//   3. checks the selection outline: if anything dragged it along with the
//      layer, it is moved straight back (outline only, never the pixels).
// No selection channel, no layer re-selection, no extra history state.
// (ExtendScript = ES3: var / function only.)
// ============================================================

var _liteApply = {"data": null, "result": "", "bounds": null};

function _liteSelKey(r) {
    return r ? r.left + "," + r.top + "," + r.right + "," + r.bottom : "";
}

// Moves the selection outline only (Move tool on a selection): not the layer,
// not the pixels
function _liteMoveSelectionBy(dx, dy) {
    var ref = new ActionReference();
    ref.putProperty(charID.Channel, charID.FrameSelect);
    var offset = new ActionDescriptor();
    offset.putUnitDouble(charID.Horizontal, charID.PixelUnit, dx);
    offset.putUnitDouble(charID.Vertical, charID.PixelUnit, dy);
    var desc = new ActionDescriptor();
    desc.putReference(charID.Null, ref);
    desc.putObject(charID.To, charID.Offset, offset);
    executeAction(charID.Move, desc, DialogModes.NO);
}

// The point the text should be centred on, or null (the text keeps its own centre):
// the centre of the box of the live selection. Nothing else is computed: no outline,
// no tail, no extra round trip (the panel only says "centre on the selection").
function _liteTarget(center, live) {
    // Fit gives the point itself (the centre of the round part of the bubble): no selection needed
    if (center && typeof center === "object" && center.fixed === true && typeof center.x === "number" && typeof center.y === "number") {
        return {"x": center.x, "y": center.y};
    }
    if (!center || !live) return null;
    if (live.width * live.height < _MIN_BUBBLE_AREA) return null;
    return {"x": live.xMid, "y": live.yMid};
}

// Text of a layer without line breaks / spaces: two texts that differ only in their line
// breaks are the same words
function _liteWords(value) {
    return String(value === undefined || value === null ? "" : value).replace(/[\s\u0003\u2028\u2029]+/g, "");
}

// Is the active layer still the one the options were made for? (the panel does not poll
// Photoshop any more, so it checks right before it writes)
function _liteStale(expect) {
    if (!expect) return false;
    try {
        if (expect.layerId !== undefined && expect.layerId !== null && Number(expect.layerId) !== Number(_getActiveLayerId())) return true;
        if (expect.text !== undefined) {
            var now = app.activeDocument.activeLayer.textItem.contents;
            if (_liteWords(now) !== _liteWords(expect.text)) return true;
        }
    } catch (e) {
        return false; // cannot tell: let the write decide
    }
    return false;
}

function _liteApplyRun() {
    var s = _liteApply;
    var d = s.data;
    s.result = "";
    s.bounds = null;
    try {
        if (_liteStale(d.expect)) {
            s.result = "stale";
            return;
        }
        var before = _liveSelectionBounds(); // also used to keep the selection where it was
        var target = d.center ? _liteTarget(d.center, before) : null;

        // 1. the text. Content only: the line breaks change and NOTHING else (size, font,
        //    leading, colour, stroke stay exactly as they are). The layer keeps its own
        //    centre unless a target was given.
        var e = d.text;
        var oldBox = target ? null : _currentLayerBox(); // only needed to keep the old centre
        var written = false;
        if (e && e.contentOnly) {
            try {
                app.activeDocument.activeLayer.textItem.contents = _normalizeTextKey(e.text);
                written = true;
            } catch (contentError) {
                written = false;
            }
        }
        if (written) {
            if (!target && oldBox) _recentreOnBox(oldBox);
        } else {
            // fallback: the stock TypeR routine (it also restores the old centre)
            var styled = e && e.text && e.style && e.style.textProps && e.style.textProps.layerText
                && e.style.textProps.layerText.textStyleRange && e.style.textProps.layerText.textStyleRange[0];
            if (styled) {
                var t = _hostState.setTextShapeRText;
                t.data = e;
                t.result = "";
                _setTextShapeRText();
                if (t.result) {
                    s.result = String(t.result);
                    return;
                }
            } else {
                var a = _hostState.setActiveLayerText;
                a.data = e;
                a.result = "";
                _setActiveLayerText();
                if (a.result) {
                    s.result = String(a.result);
                    return;
                }
            }
        }

        // 2. only the layer moves
        if (target) {
            var box = _currentLayerBox();
            if (box) {
                var dx = target.x - box.xMid;
                var dy = target.y - box.yMid;
                if (Math.abs(dx) >= 0.01 || Math.abs(dy) >= 0.01) _moveLayer(dx, dy);
            }
        }

        // 3. the selection must stay exactly where it was (best effort: the text is
        //    already written, so a problem here must never turn into an error)
        if (before) {
            try {
                var after = _liveSelectionBounds();
                if (after && (after.left !== before.left || after.top !== before.top)) {
                    _liteMoveSelectionBy(before.left - after.left, before.top - after.top);
                }
            } catch (guardError) {}
        }

        s.bounds = _getCurrentTextLayerBounds();
    } catch (err) {
        s.result = "scriptError: " + (err && err.message ? err.message : err);
    }
}

// payload: { text: { text, contentOnly: true }, center: true | null (centre on the selection),
//            expect: { layerId, text } | null (refuse when the layer is not that one any more) }
// returns JSON { error, bounds, signature }; signature has the format of
// getActiveLayerTextIfChanged so the panel need not re-read the layer
function typertoolApply(payload) {
    if (!documents.length) return jamJSON.stringify({"error": "doc", "bounds": null, "signature": ""});
    var s = _liteApply;
    s.data = payload;
    s.result = "";
    s.bounds = null;
    try {
        app.activeDocument.suspendHistory("TyperTools Change", "_liteApplyRun()");
    } catch (err) {
        s.result = "scriptError: " + (err && err.message ? err.message : err);
    }
    var signature = "";
    try {
        signature = String(_getActiveLayerId()) + ":" + String(_getActiveHistoryIndex());
    } catch (err2) {}
    var out = {"error": s.result, "bounds": s.bounds, "signature": signature};
    s.data = null;
    return jamJSON.stringify(out);
}

// ============================================================
// Fit: the round part of the selected bubble
//
// The selection is the bubble with its tail. The routine the align feature already uses opens it
// (shrinks it, then grows it back by the same amount): the tail, thinner than that, is gone and
// the round part stays; the text lying on the bubble counts as part of it. It runs on a
// temporary history state, so nothing is left behind and the selection comes back as it was.
// returns JSON { error, bounds, raw }: bounds = the box of the round part, raw = the selection
// ============================================================

var _liteBubble = {"result": null};

function _liteBubbleRead() {
    var raw = _liveSelectionBounds();
    if (!raw) return {"error": "noSelection"};
    var box = null;
    try {
        box = _currentLayerBox();
    } catch (boxError) {}
    var opened = _checkSelection({"adaptiveOpen": true, "holes": box ? [box] : []});
    if (!opened || opened.error) return {"error": opened && opened.error ? opened.error : "bubble"};
    return {"bounds": opened, "raw": raw};
}

function _liteBubbleRun() {
    _liteBubble.result = _liteBubbleRead();
}

function typertoolBubble() {
    if (!documents.length) return jamJSON.stringify({"error": "doc"});
    var r = null;
    try {
        r = _withTemporaryHistory("Typertool Fit Bubble", _liteBubbleRead, {"discardRedo": true});
    } catch (err) {
        r = null;
    }
    if (r && r.error === "historyBusy") {
        // no room for a temporary history state: read it anyway (one history state stays)
        _liteBubble.result = null;
        try {
            app.activeDocument.suspendHistory("Typertool Fit Bubble", "_liteBubbleRun()");
        } catch (err2) {}
        r = _liteBubble.result;
    }
    if (!r || r.error) return jamJSON.stringify({"error": r && r.error ? r.error : "bubble"});
    return jamJSON.stringify(r);
}

// ============================================================
// Check type: the text of the layers, read only when the panel asks.
// typertoolDocKey()    - which document is in front (cheap, one call)
// typertoolScanTexts() - every text layer of that document, in ONE pass over the layer
//                        indexes (the same flat ActionManager walk as the font scan: no DOM
//                        tree walk, no activeLayer switching). The panel runs it once per document;
//                        after that it only re-reads the layer you changed (getActiveLayerText).
// ============================================================

function typertoolDocKey() {
    try {
        if (!documents.length) return "";
        var doc = app.activeDocument;
        var id = "";
        try {
            id = String(doc.id);
        } catch (idError) {}
        return id + "|" + doc.name;
    } catch (error) {
        return "";
    }
}

function typertoolScanTexts() {
    if (!documents.length) return jamJSON.stringify({"error": "doc"});
    var propId = charIDToTypeID("Prpr");
    var layerRef = charIDToTypeID("Lyr ");
    var docRef = charIDToTypeID("Dcmn");
    var ordinalId = charIDToTypeID("Ordn");
    var targetId = charIDToTypeID("Trgt");
    var nameId = charIDToTypeID("Nm  ");
    var layerIdKey = stringIDToTypeID("layerID");
    var kindId = stringIDToTypeID("layerKind");
    var countId = stringIDToTypeID("numberOfLayers");
    var backgroundId = stringIDToTypeID("hasBackgroundLayer");
    var boundsKeys = [stringIDToTypeID("boundsNoEffects"), stringIDToTypeID("bounds")];

    var docProperty = function (key) {
        var ref = new ActionReference();
        ref.putProperty(propId, key);
        ref.putEnumerated(docRef, ordinalId, targetId);
        return executeActionGet(ref);
    };
    var layerProperty = function (key, index) {
        var ref = new ActionReference();
        ref.putProperty(propId, key);
        ref.putIndex(layerRef, index);
        return executeActionGet(ref);
    };

    var layerCount = 0;
    try {
        layerCount = docProperty(countId).getInteger(countId);
    } catch (countError) {
        return jamJSON.stringify({"error": "count"});
    }
    var hasBackground = false;
    try {
        hasBackground = docProperty(backgroundId).getBoolean(backgroundId);
    } catch (backgroundError) {}
    // Layer indexes are 0-based when a background layer exists, 1-based otherwise
    var first = hasBackground ? 0 : 1;
    var last = hasBackground ? layerCount - 1 : layerCount;

    var layers = [];
    var saveMeaningful = jamEngine.meaningfulIds;
    var saveParseFriendly = jamEngine.parseFriendly;
    jamEngine.meaningfulIds = true;
    jamEngine.parseFriendly = true;
    try {
        for (var i = first; i <= last; i++) {
            try {
                // groups and their end markers are not text layers (kind 3 is)
                if (layerProperty(kindId, i).getInteger(kindId) !== 3) continue;
                var got = jamEngine.jsonGet([
                    {"property": {"<property>": "textKey"}},
                    {"layer": {"<index>": i}}
                ]);
                if (!("textKey" in got)) continue;
                var params = jamText.fromLayerTextObject(got["textKey"]);
                if (!params || !params.layerText) continue;
                var name = "";
                try {
                    name = layerProperty(nameId, i).getString(nameId);
                } catch (nameError) {}
                var id = layerProperty(layerIdKey, i).getInteger(layerIdKey);
                // where the text sits on the page (the panel lists the closest texts together)
                var box = null;
                for (var k = 0; k < boundsKeys.length && !box; k++) {
                    try {
                        var b = layerProperty(boundsKeys[k], i).getObjectValue(boundsKeys[k]);
                        box = {
                            "left": b.getUnitDoubleValue(charIDToTypeID("Left")),
                            "top": b.getUnitDoubleValue(charIDToTypeID("Top ")),
                            "right": b.getUnitDoubleValue(charIDToTypeID("Rght")),
                            "bottom": b.getUnitDoubleValue(charIDToTypeID("Btom"))
                        };
                    } catch (boundsError) {}
                }
                layers.push({"id": id, "name": name, "text": String(params.layerText.textKey || ""), "box": box});
            } catch (layerError) {}
        }
    } finally {
        jamEngine.meaningfulIds = saveMeaningful;
        jamEngine.parseFriendly = saveParseFriendly;
    }
    return jamJSON.stringify({"docKey": typertoolDocKey(), "layers": layers});
}
