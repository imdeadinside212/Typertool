import './CheckTypePanel.scss';

import React from 'react';
import {FiFilePlus, FiRefreshCw} from 'react-icons/fi';

import {evalHost, safeJsonParse, isVietnamese} from '../shim/utils';
import {parseScript, checkRows, arrangeRows} from '../lib/checkType';

const t = isVietnamese ? {
    add: 'Add .json',
    scan: 'Quét lại',
    scanTip: 'Quét lại toàn bộ text của file đang mở',
    empty: 'Thêm file script .json: dòng nào khác text trong layer Photoshop sẽ hiện nền đỏ.',
    noDoc: 'Hãy mở một file trong Photoshop.',
    noLines: 'File này không có dòng nào có mã (1_, 2_...).',
    lines: 'dòng',
    bad: 'cần sửa',
    missing: 'chưa có layer',
    badTip: 'Text trong layer khác với script',
    missingTip: 'Không layer nào có mã này',
} : {
    add: 'Add .json',
    scan: 'Rescan',
    scanTip: 'Scan all the text of the open file again',
    empty: 'Add a .json script: every line whose text differs from the Photoshop layer turns red.',
    noDoc: 'Open a file in Photoshop.',
    noLines: 'This file has no line with a code (1_, 2_...).',
    lines: 'lines',
    bad: 'to fix',
    missing: 'no layer',
    badTip: 'The text of the layer is not the text of the script',
    missingTip: 'No layer has this code',
};

const STORAGE_KEY = 'typertoolCheckScript';

const loadScript = () => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        if (parsed && Array.isArray(parsed.rows)) return parsed;
    } catch (error) {}
    return null;
};

const saveScript = script => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(script));
    } catch (error) {}
};

const sameBox = (a, b) => (!a && !b) || (!!a && !!b && a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom);

// Checks the lines of a script against the text layers of the open document.
// The whole document is scanned ONCE (when the script is added to an unscanned document, or when
// another document comes in front); after that only the layer you changed is read again. Nothing
// runs in the background: Photoshop is asked when the pointer enters the panel, when the panel
// gets the focus or becomes visible, and when a button is pressed.
const CheckTypePanel = React.memo(function CheckTypePanel() {
    const [script, setScript] = React.useState(loadScript);
    const [layers, setLayers] = React.useState([]);
    const [scanned, setScanned] = React.useState(false);
    const [note, setNote] = React.useState('');
    const [busy, setBusy] = React.useState(false);

    const fileInputRef = React.useRef(null);
    const docKeyRef = React.useRef(null);
    const layersRef = React.useRef(layers);
    const scriptRef = React.useRef(script);
    const inflightRef = React.useRef(false);
    const lastRef = React.useRef(0);
    layersRef.current = layers;
    scriptRef.current = script;

    const scanAll = async () => {
        setBusy(true);
        try {
            const data = safeJsonParse(await evalHost('typertoolScanTexts()', 120000), {});
            if (data.error || !Array.isArray(data.layers)) {
                docKeyRef.current = null;
                setLayers([]);
                setScanned(false);
                setNote(t.noDoc);
            } else {
                docKeyRef.current = data.docKey;
                setLayers(data.layers);
                setScanned(true);
                setNote('');
            }
        } finally {
            setBusy(false);
        }
    };

    // only the layer in front: its text, name and place
    const recheckActive = async () => {
        const data = safeJsonParse(await evalHost('getActiveLayerText()', 10000), null);
        if (!data || data.error || typeof data.layerId !== 'number' || !data.textProps || !data.textProps.layerText) return;
        const b = data.bounds;
        const next = {
            id: data.layerId,
            name: data.layerName || '',
            text: String(data.textProps.layerText.textKey || ''),
            box: b ? {left: b.left, top: b.top, right: b.right, bottom: b.bottom} : null,
        };
        const list = layersRef.current;
        const at = list.findIndex(layer => layer.id === next.id);
        if (at < 0) {
            setLayers(list.concat(next));
            return;
        }
        const old = list[at];
        if (old.name === next.name && old.text === next.text && sameBox(old.box, next.box)) return;
        const copy = list.slice();
        copy[at] = next;
        setLayers(copy);
    };

    const refresh = async force => {
        if (inflightRef.current || !scriptRef.current) return;
        inflightRef.current = true;
        try {
            const key = await evalHost('typertoolDocKey()', 5000);
            if (!key) {
                docKeyRef.current = null;
                setLayers([]);
                setScanned(false);
                setNote(t.noDoc);
            } else if (force || key !== docKeyRef.current) {
                await scanAll(); // the one full scan: a file that was not scanned yet
            } else {
                await recheckActive();
            }
        } finally {
            inflightRef.current = false;
            lastRef.current = Date.now();
        }
    };

    const refreshSoon = () => {
        if (document.hidden || Date.now() - lastRef.current < 300) return;
        refresh(false);
    };
    const refreshSoonRef = React.useRef(refreshSoon);
    refreshSoonRef.current = refreshSoon;

    React.useEffect(() => {
        refresh(false);
        const onFocus = () => refreshSoonRef.current();
        const onVisible = () => {
            if (!document.hidden) refreshSoonRef.current();
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    const pickFile = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const onFilePicked = event => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const rows = parseScript(reader.result);
            if (!rows.length) {
                setNote(t.noLines);
                return;
            }
            const next = {name: file.name, rows};
            setScript(next);
            scriptRef.current = next;
            saveScript(next);
            setNote('');
            // a document that is already scanned is only compared again, nothing is read from Photoshop
            if (docKeyRef.current) return;
            refresh(true);
        };
        reader.readAsText(file, 'utf-8');
    };

    const checks = React.useMemo(() => (script ? checkRows(script.rows, layers) : []), [script, layers]);
    const order = React.useMemo(() => arrangeRows(checks), [checks]);
    const badCount = scanned ? checks.filter(check => check.status === 'bad').length : 0;
    const missingCount = scanned ? checks.filter(check => check.status === 'missing').length : 0;

    let summary = '';
    if (script) {
        summary = script.rows.length + ' ' + t.lines;
        if (scanned) summary = badCount + ' ' + t.bad + ' · ' + missingCount + ' ' + t.missing + ' · ' + summary;
    }

    return (
        <div className="ct" onMouseEnter={() => refreshSoonRef.current()}>
            <input
                type="file"
                accept=".json,.txt,application/json"
                ref={fileInputRef}
                style={{display: 'none'}}
                onChange={onFilePicked}
            />
            <div className="ct-bar">
                <button type="button" className="topcoat-button--large ct-btn" onClick={pickFile}>
                    <FiFilePlus size={14} /> {t.add}
                </button>
                <button
                    type="button"
                    className="topcoat-button--large ct-btn"
                    disabled={!script || busy}
                    title={t.scanTip}
                    onClick={() => refresh(true)}
                >
                    <FiRefreshCw size={14} /> {t.scan}
                </button>
            </div>
            <div className="ct-summary" title={script ? script.name : ''}>{summary}</div>
            {note ? <div className="ct-note">{note}</div> : null}
            {script ? (
                <div className="ct-list">
                    {order.map(index => {
                        const row = script.rows[index];
                        const status = scanned ? checks[index].status : 'idle';
                        return (
                            <div
                                key={index}
                                className={'ct-row is-' + status}
                                title={status === 'bad' ? t.badTip : (status === 'missing' ? t.missingTip : '')}
                            >
                                <span className="ct-num">{row.key}</span>
                                <span className="ct-text">{row.text}</span>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="ct-empty">{t.empty}</div>
            )}
        </div>
    );
});

export default CheckTypePanel;
