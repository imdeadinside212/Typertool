import './LineBreakPanel.scss';

import React from 'react';
import {FiCrosshair, FiStar} from 'react-icons/fi';

import {csInterface, evalHost, safeJsonParse, nativeAlert, locale, isVietnamese} from '../shim/utils';
import {buildOptionTable, isCleanBreak, textWidth} from '../lib/lineBreaker';
import {startGlobalKeys} from '../lib/globalKeys';

// Photoshop sends this event when one of the "Typertool - N lines" scripts runs (see README)
const SHORTCUT_EVENT = 'com.typertool.shortcut';

const text = isVietnamese ? {
    title: 'Ngắt dòng',
    autoCenter: 'Auto center',
    autoCenterTip: 'Bật: bấm option thì chữ tự căn giữa vùng đang select (tâm khung của vùng select, không tính gì thêm nên rất nhanh). Không có vùng select thì giữ nguyên tâm chữ',
    stale: 'Layer đã đổi bên Photoshop: bấm lại',
    best: 'Đẹp nhất',
    bestTip: 'Những option tròn nhất trong mọi số dòng',
    lines: 'dòng',
    options: 'option',
    noLayer: 'Chọn một layer chữ để ngắt dòng.',
    one: 'Chỉ có 1 chữ, không có gì để ngắt.',
    current: 'đang dùng',
    applied: 'Đã áp dụng',
    failed: 'Không ghi được text vào layer.',
    refused: 'Option bị từ chối: text sẽ bị đổi.',
} : {
    title: 'Line break',
    autoCenter: 'Auto center',
    autoCenterTip: 'On: clicking an option centers the text on the selection (the center of its box, nothing else is calculated, so it is fast). Without a selection the text keeps its own center',
    stale: 'The layer changed in Photoshop: click again',
    best: 'Best',
    bestTip: 'The roundest options over every number of lines',
    lines: 'lines',
    options: 'options',
    noLayer: 'Select a text layer to break.',
    one: 'Only one word: nothing to break.',
    current: 'current',
    applied: 'Applied',
    failed: 'Could not write the text to the layer.',
    refused: 'Option refused: it would change the text.',
};

const flatten = value => String(value || '').replace(/\r\n/g, '\n').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const readStored = (key, fallback) => {
    try {
        const raw = window.localStorage.getItem(key);
        if (raw !== null) return raw === '1';
    } catch (error) {}
    return fallback;
};

// Pixels per width unit and per line of the layer as it is drawn now; frozen
// per layer and text so that the order of the options does not move around
// each time another one is applied
const calibrate = (source, flat) => {
    if (!source || !source.bounds || !(source.bounds.width > 0) || !(source.bounds.height > 0)) return null;
    const lines = String(source.text || '').split(/\r\n|\r|\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) return null;
    const maxUnits = Math.max(...lines.map(textWidth));
    if (!(maxUnits > 0)) return null;
    const glyphRatio = /[gjpqyç()]/.test(lines.join('')) ? 0.8 : 0.62;
    return {unitPx: source.bounds.width / maxUnits, linePx: source.bounds.height / (lines.length - 1 + glyphRatio)};
};

const fontSizeOf = source => {
    try {
        const style = source.textProps.layerText.textStyleRange[0].textStyle;
        return Math.round((style.size || 0) * 100) / 100;
    } catch (error) {
        return 0;
    }
};

// A text box of the panel keeps its focus after you click back into Photoshop, so being the
// active element is not enough: the panel itself must also have the keyboard focus
const isTypingInPanel = () => !!(document.hasFocus && document.hasFocus()
    && document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName));

const LineBreakPanel = React.memo(function LineBreakPanel({bindings, recordingRef, onKeysStatus, blockKeys}) {
    const [source, setSource] = React.useState(null);
    const [selection, setSelection] = React.useState(null);
    const [count, setCount] = React.useState('best');
    const [busy, setBusy] = React.useState(false);
    const [status, setStatus] = React.useState('');
    const [autoCenter, setAutoCenter] = React.useState(() => readStored('typertoolAutoCenter', true));

    const sigRef = React.useRef('');
    const selKeyRef = React.useRef('');
    const busyRef = React.useRef(false);
    const calibRef = React.useRef({key: '', value: null});
    const stateRef = React.useRef({});
    const inflightRef = React.useRef(null);
    const lastRefreshRef = React.useRef(0);
    const shortcutRunning = React.useRef(false);
    const pendingCommandRef = React.useRef(null);
    const pendingRef = React.useRef(null);
    const bindingsRef = React.useRef(bindings);
    const keysStatusRef = React.useRef(onKeysStatus);
    const statusTimer = React.useRef(null);

    bindingsRef.current = bindings;
    keysStatusRef.current = onKeysStatus;

    const flat = React.useMemo(() => flatten(source && source.text), [source && source.text]);

    // --- what Photoshop currently has: the text layer and the selection.
    // Nothing polls Photoshop: this is read when the pointer enters the panel, when the panel
    // gets the focus or becomes visible, when a shortcut fires and after a click that could
    // not tell the new state. Between those moments the panel does not touch Photoshop at all.
    const refresh = React.useCallback(() => {
        if (inflightRef.current) return inflightRef.current;
        const run = async () => {
            const known = stateRef.current || {};
            const raw = await evalHost('getTypeRPanelSnapshot(' + JSON.stringify({signature: sigRef.current}) + ')', 10000);
            const snapshot = safeJsonParse(raw, null);
            if (!snapshot) return {source: known.source || null, selection: known.selection || null};
            const sel = snapshot.selection && snapshot.selection.width > 0 ? snapshot.selection : null;
            const selKey = sel ? [sel.left, sel.top, sel.right, sel.bottom].join(',') : '';
            const nextSelection = sel ? {key: selKey, bounds: sel} : null;
            if (selKey !== selKeyRef.current) {
                selKeyRef.current = selKey;
                setSelection(nextSelection);
            }
            const layer = snapshot.activeLayer;
            if (!layer || layer.error) {
                sigRef.current = '';
                setSource(null);
                return {source: null, selection: nextSelection};
            }
            if (layer.unchanged) return {source: known.source || null, selection: nextSelection};
            sigRef.current = layer.signature || '';
            if (!layer.textProps || !layer.textProps.layerText) {
                setSource(null);
                return {source: null, selection: nextSelection};
            }
            const next = {
                text: String(layer.textProps.layerText.textKey || ''),
                layerId: typeof layer.layerId === 'number' ? layer.layerId : null,
                layerName: layer.layerName || '',
                bounds: layer.bounds || null,
                textProps: layer.textProps,
                stroke: layer.stroke || null,
            };
            setSource(next);
            return {source: next, selection: nextSelection};
        };
        const promise = run().then(value => {
            inflightRef.current = null;
            lastRefreshRef.current = Date.now();
            return value;
        }, error => {
            inflightRef.current = null;
            throw error;
        });
        inflightRef.current = promise;
        return promise;
    }, []);

    const refreshSoon = React.useCallback(() => {
        if (busyRef.current || document.hidden) return;
        if (Date.now() - lastRefreshRef.current < 250) return;
        refresh();
    }, [refresh]);

    React.useEffect(() => {
        refresh();
        const onVisible = () => {
            if (!document.hidden) refreshSoon();
        };
        window.addEventListener('focus', refreshSoon);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.removeEventListener('focus', refreshSoon);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [refresh, refreshSoon]);

    // --- the options
    const getCalibration = (src, fl) => {
        if (!src || !fl) return null;
        const key = src.layerId + '|' + fl + '|' + fontSizeOf(src);
        if (calibRef.current.key !== key) calibRef.current = {key, value: calibrate(src, fl)};
        return calibRef.current.value;
    };
    // the selection only gives the proportions of the bubble (it orders the extra options)
    const makeSettings = (cal, sel) => {
        const lineUnits = cal ? clamp(cal.linePx / cal.unitPx, 1.4, 3.4) : 2;
        const b = sel && sel.bounds && sel.bounds.height > 0 ? sel.bounds : null;
        const target = b ? clamp(b.width / b.height, 0.4, 2.6) : 1;
        const fit = b && cal ? {unitPx: cal.unitPx, width: b.width, height: b.height} : null;
        return {target, lineUnits, fit};
    };

    const calibration = React.useMemo(() => getCalibration(source, flat), [source, flat]);
    const settings = React.useMemo(() => makeSettings(calibration, selection), [calibration, selection]);

    const table = React.useMemo(() => (flat ? buildOptionTable(flat, settings) : null), [flat, settings]);

    const list = React.useMemo(() => {
        if (!table) return [];
        if (count === 'best') return table.best;
        return table.byCount[count] || [];
    }, [table, count]);

    React.useEffect(() => {
        if (table && count !== 'best' && !table.byCount[count]) setCount('best');
    }, [table, count]);

    const showStatus = message => {
        setStatus(message);
        if (statusTimer.current) clearTimeout(statusTimer.current);
        statusTimer.current = setTimeout(() => setStatus(''), 2200);
    };

    stateRef.current = {table, source, autoCenter, selection, flat};

    // --- apply an option to the layer: ONE host call writes the text, moves only the layer onto
    // the center of the selection and leaves everything else alone. The panel does not poll
    // Photoshop, so it tells the host which layer and words it based the options on and the
    // host refuses (stale) when the layer is not that one any more.
    const applyOption = async (option, override) => {
        const current = override ? Object.assign({}, stateRef.current, override) : stateRef.current;
        if (!option || !current.source) return;
        if (busyRef.current) {
            pendingRef.current = option; // clicked while busy: the latest click runs next
            return;
        }
        if (!isCleanBreak(current.flat, option.lines)) {
            nativeAlert(text.refused, locale.errorTitle, true);
            return;
        }
        busyRef.current = true;
        setBusy(true);
        let knownState = false;
        try {
            const payload = {
                text: {text: option.text, contentOnly: true}, // only the line breaks change, never the size or style
                center: current.autoCenter ? true : null,
                expect: {layerId: current.source.layerId, text: current.source.text},
            };
            const result = safeJsonParse(await evalHost('typertoolApply(' + JSON.stringify(payload) + ')'), null);
            if (result && result.error === 'stale') {
                showStatus(text.stale);
            } else if (!result || result.error) {
                nativeAlert(text.failed, locale.errorTitle, true);
            } else {
                // what the layer is now, without reading it back from Photoshop
                const key = String(option.text).replace(/\r\n/g, '\r').replace(/\n/g, '\r');
                const next = Object.assign({}, current.source, {
                    text: key,
                    bounds: result.bounds || current.source.bounds,
                    textProps: Object.assign({}, current.source.textProps, {
                        layerText: Object.assign({}, current.source.textProps.layerText, {textKey: key}),
                    }),
                });
                stateRef.current = Object.assign({}, stateRef.current, {source: next});
                setSource(next);
                knownState = !!result.signature;
                sigRef.current = result.signature || '';
                showStatus(text.applied + ': ' + option.count + ' ' + text.lines);
            }
        } finally {
            if (!knownState) sigRef.current = ''; // unknown: read the layer again
            busyRef.current = false;
            setBusy(false);
            const pending = pendingRef.current;
            pendingRef.current = null;
            if (pending) applyOption(pending);
            else if (!knownState) refresh();
        }
    };

    // --- shortcuts: the first option of a line count (or the best one). The layer is read first
    // (there is no polling, so what the panel shows may be old), then the matching number button
    // lights up and its first option is applied at once.
    const runShortcut = async command => {
        if (shortcutRunning.current) {
            pendingCommandRef.current = command;
            return;
        }
        shortcutRunning.current = true;
        try {
            const fresh = await refresh();
            const src = fresh && fresh.source;
            const fl = flatten(src && src.text);
            if (!src || !fl) {
                showStatus(text.noLayer);
                return;
            }
            const fresher = buildOptionTable(fl, makeSettings(getCalibration(src, fl), fresh.selection));
            const options = command === 'best' ? fresher.best : fresher.byCount[command];
            if (!options || !options.length) return;
            setCount(command === 'best' ? 'best' : Number(command)); // the button lights up
            await applyOption(options[0], {source: src, flat: fl, selection: fresh.selection});
        } finally {
            shortcutRunning.current = false;
            const queued = pendingCommandRef.current;
            pendingCommandRef.current = null;
            if (queued) runShortcut(queued);
        }
    };
    const runShortcutRef = React.useRef(runShortcut);
    runShortcutRef.current = runShortcut;

    // the scripts "Typertool - N lines" (File > Scripts, with the keys you gave them in Photoshop)
    React.useEffect(() => {
        const onShortcut = event => {
            const command = String((event && event.data) || '').trim();
            if (command) runShortcutRef.current(command);
        };
        csInterface.addEventListener(SHORTCUT_EVENT, onShortcut);
        return () => csInterface.removeEventListener(SHORTCUT_EVENT, onShortcut);
    }, []);

    // The shortcut keys (ALT+1 ... ALT+9, ALT+0 by default), heard by a small helper process that
    // never asks Photoshop anything; nothing is listened to while this panel is collapsed.
    const bindingsKey = JSON.stringify(bindings);
    React.useEffect(() => {
        const stop = startGlobalKeys({
            bindings: bindingsRef.current,
            block: blockKeys,
            onPress: command => {
                if (recordingRef.current || isTypingInPanel()) return;
                runShortcutRef.current(command);
            },
            onStatus: status => {
                if (keysStatusRef.current) keysStatusRef.current(status);
            },
        });
        return () => {
            stop();
            if (keysStatusRef.current) keysStatusRef.current({state: 'off', detail: ''});
        };
    }, [bindingsKey, blockKeys]);

    const toggleAutoCenter = () => {
        const next = !autoCenter;
        setAutoCenter(next);
        try {
            window.localStorage.setItem('typertoolAutoCenter', next ? '1' : '0');
        } catch (error) {}
    };

    // --- render
    const currentText = source ? String(source.text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim() : '';
    const visible = list; // every option of the chosen line count, all at once
    const countButtons = [];
    for (let n = 1; n <= 15; n++) {
        const options = table && table.byCount[n];
        countButtons.push(
            <button
                key={n}
                type="button"
                className={'lb-count' + (count === n ? ' is-on' : '')}
                disabled={!options}
                title={options ? n + ' ' + text.lines + ' · ' + options.length + ' ' + text.options : ''}
                onClick={() => setCount(n)}
            >{n}</button>
        );
    }

    let message = '';
    if (!source) message = text.noLayer;
    else if (table && table.wordCount < 2) message = text.one;

    return (
        <div className="lb" onMouseEnter={refreshSoon}>
            <div className="lb-sticky">
            <div className="lb-head">
                <button
                    type="button"
                    className={'lb-toggle' + (autoCenter ? ' is-on' : '')}
                    title={text.autoCenterTip}
                    onClick={toggleAutoCenter}
                >
                    <FiCrosshair size={13} /> {text.autoCenter}
                </button>
                <span className="lb-status">{busy ? '…' : status}</span>
            </div>
            <div className="lb-counts">
                <button
                    type="button"
                    className={'lb-count lb-best' + (count === 'best' ? ' is-on' : '')}
                    disabled={!table || !table.best.length}
                    title={text.bestTip}
                    onClick={() => setCount('best')}
                ><FiStar size={12} /></button>
                {countButtons}
            </div>
            </div>
            {message ? <div className="lb-message">{message}</div> : (
                <React.Fragment>
                    <div className="lb-grid">
                        {visible.map((option, index) => {
                            const widest = Math.max(...option.lines.map(line => line.length));
                            const size = clamp(13 - Math.max(0, widest - 14) * 0.22, 8, 13);
                            const isCurrent = option.text === currentText;
                            return (
                                <button
                                    key={option.key + '|' + option.count}
                                    type="button"
                                    className={'lb-card' + (isCurrent ? ' is-current' : '')}
                                    title={option.count + ' ' + text.lines + (isCurrent ? ' · ' + text.current : '')}
                                    onClick={() => applyOption(option)}
                                >
                                    <span className="lb-badge">{index + 1}</span>
                                    <pre style={{fontSize: size + 'px'}}>{option.text}</pre>
                                    {count === 'best' ? <span className="lb-lines">{option.count}</span> : null}
                                </button>
                            );
                        })}
                    </div>
                </React.Fragment>
            )}
        </div>
    );
});

export default LineBreakPanel;
