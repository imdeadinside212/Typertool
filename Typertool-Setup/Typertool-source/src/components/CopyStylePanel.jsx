import './CopyStylePanel.scss';

import React from 'react';

import {csInterface, isVietnamese} from '../shim/utils';

// The Copy Style panel, as it was: a button and three switches. The switches
// keep their old storage keys, so the settings of the old panel carry over.
const labels = isVietnamese
    ? {run: 'Copy effect', style: 'Bold / Italic', size: 'Size', center: 'Auto center', baseHint: 'size gốc B',
        baseTip: 'Chọn Sp hoặc Nar (nút xanh) rồi nhập size gốc của layer B: size A tăng tính từ số này. Bỏ chọn cả hai = tự thống kê size gốc.'}
    : {run: 'Copy effect', style: 'Bold / Italic', size: 'Size', center: 'Auto center', baseHint: 'B base size',
        baseTip: 'Pick Sp or Nar (blue button) and type the original size of layer B: the size increase is calculated from that number. Pick neither to use the automatic base size.'};

const useStoredSwitch = (key, fallback) => {
    const [on, setOn] = React.useState(() => {
        try {
            const value = window.localStorage.getItem(key);
            if (value !== null) return value === '1';
        } catch (error) {}
        return fallback;
    });
    const toggle = () => {
        const next = !on;
        setOn(next);
        try {
            window.localStorage.setItem(key, next ? '1' : '0');
        } catch (error) {}
    };
    return [on, toggle];
};

const Switch = ({label, on, onToggle}) => (
    <div className={'cs-toggle' + (on ? ' on' : '')} onClick={onToggle}>
        <span>{label}</span>
        <span className="cs-sw" />
    </div>
);

const readStored = (key, fallback) => {
    try {
        const value = window.localStorage.getItem(key);
        if (value !== null) return value;
    } catch (error) {}
    return fallback;
};
const writeStored = (key, value) => {
    try {
        window.localStorage.setItem(key, value);
    } catch (error) {}
};

// "Sp" / "Nar": the original size of layer B typed by hand. Pick one (blue) and the size
// calculation starts from that number; the other box is ignored. Pick none and the base
// size is worked out from the document as before.
const BASES = [{id: 'sp', label: 'Sp'}, {id: 'nar', label: 'Nar'}];

const CopyStylePanel = React.memo(function CopyStylePanel() {
    const [baseMode, setBaseMode] = React.useState(() => {
        const stored = readStored('csBaseMode', '');
        return stored === 'sp' || stored === 'nar' ? stored : '';
    });
    const [baseValues, setBaseValues] = React.useState(() => ({sp: readStored('csBaseSp', ''), nar: readStored('csBaseNar', '')}));
    const pickBase = id => {
        const next = baseMode === id ? '' : id; // click again to deselect
        setBaseMode(next);
        writeStored('csBaseMode', next);
    };
    const typeBase = (id, value) => {
        const clean = value.replace(',', '.').replace(/[^0-9.]/g, '');
        setBaseValues(Object.assign({}, baseValues, {[id]: clean}));
        writeStored(id === 'sp' ? 'csBaseSp' : 'csBaseNar', clean);
    };

    const [styleOn, toggleStyle] = useStoredSwitch('matchStyle', true);
    const [sizeOn, toggleSize] = useStoredSwitch('scaleSize', true);
    const [centerOn, toggleCenter] = useStoredSwitch('autoCenter', false);

    const run = () => {
        const typed = baseMode ? parseFloat(baseValues[baseMode]) : 0;
        const manual = typed > 0 ? typed : 0; // 0 = automatic base size
        csInterface.evalScript('copyStylePanelRun(' + (styleOn ? 'true' : 'false') + ',' + (sizeOn ? 'true' : 'false') + ',' + (centerOn ? 'true' : 'false') + ',' + manual + ')');
    };

    return (
        <div className="cs">
            <button type="button" className="cs-run" onClick={run}>{labels.run}</button>
            <Switch label={labels.style} on={styleOn} onToggle={toggleStyle} />
            <Switch label={labels.size} on={sizeOn} onToggle={toggleSize} />
            <Switch label={labels.center} on={centerOn} onToggle={toggleCenter} />
            <div className="cs-bases" title={labels.baseTip}>
                {BASES.map(base => (
                    <div key={base.id} className={'cs-base' + (baseMode === base.id ? ' on' : '')}>
                        <button type="button" className="cs-base-btn" onClick={() => pickBase(base.id)}>{base.label}</button>
                        <input
                            type="text"
                            inputMode="decimal"
                            className="cs-base-input"
                            placeholder={labels.baseHint}
                            value={baseValues[base.id]}
                            disabled={baseMode !== base.id}
                            onChange={event => typeBase(base.id, event.target.value)}
                            onKeyDown={event => { if (event.key === 'Enter') event.target.blur(); }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
});

export default CopyStylePanel;
