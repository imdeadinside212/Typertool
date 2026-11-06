import './app.scss';

import React from 'react';
import {createRoot} from 'react-dom/client';
import {FiSettings, FiChevronUp, FiChevronDown} from 'react-icons/fi';

import LineBreakPanel from './components/LineBreakPanel';
import CheckTypePanel from './components/CheckTypePanel';
import MaskImagesPanel from './components/maskImagesPanel/maskImagesPanel';
import CopyStylePanel from './components/CopyStylePanel';
import ShortcutSettings, {shortcutText} from './components/ShortcutSettings';
import {loadBindings, saveBindings} from './lib/hotkeys';
import {isVietnamese} from './shim/utils';

const titles = isVietnamese
    ? {lineBreak: 'Ngắt dòng', checkType: 'Check type', mask: 'Mask ảnh', copyStyle: 'Copy style', reset: 'Bấm đúp để đặt lại kích thước', collapse: 'Thu gọn (khung này sẽ ngừng hoạt động)', expand: 'Mở ra', allHidden: 'Tất cả các khung đang ẩn. Vào Cài đặt > Bố cục giao diện để hiện lại.'}
    : {lineBreak: 'Line break', checkType: 'Check type', mask: 'Image mask', copyStyle: 'Copy style', reset: 'Double-click to reset the sizes', collapse: 'Collapse (this panel stops working while hidden)', expand: 'Expand', allHidden: 'All panels are hidden. Open Settings > Interface layout to show them again.'};

// Relative heights of the four sections (they always fill the panel)
const SECTION_COUNT = 4;
const DEFAULT_SIZES = [28, 24, 28, 20];
const MIN_HEIGHT = 90; // px, also set in app.scss
const SIZES_KEY = 'typertoolSectionSizes';

const loadSizes = () => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(SIZES_KEY));
        if (Array.isArray(parsed) && parsed.length === SECTION_COUNT && parsed.every(n => typeof n === 'number' && isFinite(n) && n > 0)) return parsed;
    } catch (error) {}
    return DEFAULT_SIZES;
};

const COLLAPSED_KEY = 'typertoolCollapsed';

const loadCollapsed = () => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(COLLAPSED_KEY));
        if (Array.isArray(parsed) && parsed.length === SECTION_COUNT) return parsed.map(Boolean);
    } catch (error) {}
    return DEFAULT_SIZES.map(() => false);
};

const saveCollapsed = collapsed => {
    try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch (error) {}
};

// Which panel is where, and which are switched off. A panel is identified by its number (0 line
// break, 1 check type, 2 image mask, 3 copy style): its size and collapsed state follow the panel
// when it is moved. A hidden panel is not drawn at all (no title bar) and not mounted, so it does
// nothing until it is shown again.
const ORDER_KEY = 'typertoolOrder';
const HIDDEN_KEY = 'typertoolHidden';
const DEFAULT_ORDER = DEFAULT_SIZES.map((_, i) => i);

const loadOrder = () => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(ORDER_KEY));
        if (Array.isArray(parsed) && parsed.length === SECTION_COUNT && DEFAULT_ORDER.every(i => parsed.includes(i))) return parsed;
    } catch (error) {}
    return DEFAULT_ORDER;
};

const loadHidden = () => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(HIDDEN_KEY));
        if (Array.isArray(parsed) && parsed.length === SECTION_COUNT) return parsed.map(Boolean);
    } catch (error) {}
    return DEFAULT_ORDER.map(() => false);
};

const saveSizes = sizes => {
    try {
        window.localStorage.setItem(SIZES_KEY, JSON.stringify(sizes));
    } catch (error) {}
};

// A collapsed section shows only its title bar: its content is not even mounted, so whatever
// the panel inside does (listening to Photoshop, to the keyboard...) stops while it is hidden
const Section = ({title, className, style, sectionRef, collapsed, onToggle, children}) => (
    <section className={'section ' + (className || '') + (collapsed ? ' is-collapsed' : '')} style={style} ref={sectionRef}>
        <header className="section-title">
            <span>{title}</span>
            <button
                type="button"
                className="section-toggle"
                title={collapsed ? titles.expand : titles.collapse}
                aria-expanded={!collapsed}
                onClick={onToggle}
            >
                {collapsed ? <FiChevronDown size={14} /> : <FiChevronUp size={14} />}
            </button>
        </header>
        {collapsed ? null : <div className="section-body">{children}</div>}
    </section>
);

// The bar between two sections: drag it to move the border, double-click to reset
const Splitter = ({onStart, onReset, disabled}) => (
    <div className={'splitter' + (disabled ? ' is-disabled' : '')} title={disabled ? '' : titles.reset} onMouseDown={disabled ? undefined : onStart} onDoubleClick={disabled ? undefined : onReset}>
        <span className="splitter-grip" />
    </div>
);

const App = () => {
    const [sizes, setSizes] = React.useState(loadSizes);
    const [bindings, setBindingsState] = React.useState(loadBindings);
    const [showShortcuts, setShowShortcuts] = React.useState(false);
    const [keysStatus, setKeysStatus] = React.useState({state: 'off', detail: ''});
    // keep the keys of a shortcut away from Photoshop (so Shift+F2 does not also run Photoshop's F2)
    const [blockKeys, setBlockKeysState] = React.useState(() => {
        try {
            return window.localStorage.getItem('typertoolBlockKeys') !== '0';
        } catch (error) {
            return true;
        }
    });
    const setBlockKeys = on => {
        setBlockKeysState(on);
        try {
            window.localStorage.setItem('typertoolBlockKeys', on ? '1' : '0');
        } catch (error) {}
    };
    const [collapsed, setCollapsedState] = React.useState(loadCollapsed);
    const [order, setOrder] = React.useState(loadOrder);
    const [hidden, setHidden] = React.useState(loadHidden);
    const sectionRefs = React.useRef(DEFAULT_SIZES.map(() => null));
    const sizesRef = React.useRef(sizes);
    const recordingRef = React.useRef(false);

    sizesRef.current = sizes;
    const collapsedRef = React.useRef(collapsed);
    collapsedRef.current = collapsed;

    const toggleCollapsed = index => {
        setCollapsedState(previous => previous.map((value, i) => (i === index ? !value : value)));
    };
    React.useEffect(() => saveCollapsed(collapsed), [collapsed]);

    // the panels that are drawn, top to bottom
    const visible = order.filter(i => !hidden[i]);
    const visibleRef = React.useRef(visible);
    visibleRef.current = visible;
    React.useEffect(() => {
        try {
            window.localStorage.setItem(ORDER_KEY, JSON.stringify(order));
            window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
        } catch (error) {}
    }, [order, hidden]);

    // one step up (-1) or down (+1) in the list of all the panels (hidden ones included)
    const movePanel = (panel, step) => {
        setOrder(previous => {
            const at = previous.indexOf(panel);
            const to = at + step;
            if (at < 0 || to < 0 || to >= previous.length) return previous;
            const next = previous.slice();
            next[at] = previous[to];
            next[to] = panel;
            return next;
        });
    };
    const toggleHidden = panel => {
        setHidden(previous => previous.map((value, i) => (i === panel ? !value : value)));
    };

    const setBindings = next => {
        setBindingsState(next);
        saveBindings(next);
    };

    // The bar at position `index` (between the drawn panels `index` and `index + 1`) moves the border
    // between the nearest OPEN panel above it and the nearest open one below it, so with a panel
    // collapsed the bars still resize the others. Returns the numbers of the two panels, or null.
    const dragPair = index => {
        const shown = visibleRef.current;
        let up = index;
        while (up >= 0 && collapsedRef.current[shown[up]]) up--;
        let down = index + 1;
        while (down < shown.length && collapsedRef.current[shown[down]]) down++;
        return up >= 0 && down < shown.length ? [shown[up], shown[down]] : null;
    };

    const startDrag = index => event => {
        if (event.button !== 0) return;
        const pair = dragPair(index);
        if (!pair) return;
        const [upper, lower] = pair;
        event.preventDefault();
        const heights = sectionRefs.current.map(el => (el ? el.getBoundingClientRect().height : 0));
        const startY = event.clientY;
        const startSizes = sizesRef.current.slice();
        document.body.classList.add('is-resizing');

        const finish = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', finish);
            window.removeEventListener('blur', finish);
            document.body.classList.remove('is-resizing');
            saveSizes(sizesRef.current);
        };
        const move = e => {
            if (e.buttons === 0) { // the button was released outside the panel
                finish();
                return;
            }
            const shrinkAbove = Math.max(0, heights[upper] - MIN_HEIGHT);
            const shrinkBelow = Math.max(0, heights[lower] - MIN_HEIGHT);
            const dy = Math.max(-shrinkAbove, Math.min(shrinkBelow, e.clientY - startY));
            const next = heights.slice();
            next[upper] += dy;
            next[lower] -= dy;
            // only the open sections share the weights; a collapsed one keeps its own for later
            const open = visibleRef.current.filter(i => !collapsedRef.current[i]);
            const weight = open.reduce((sum, i) => sum + startSizes[i], 0);
            const total = open.reduce((sum, i) => sum + next[i], 0) || 1;
            const sizesNow = startSizes.slice();
            open.forEach(i => { sizesNow[i] = (next[i] / total) * weight; });
            setSizes(sizesNow);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', finish);
        window.addEventListener('blur', finish);
    };

    const resetSizes = () => {
        setSizes(DEFAULT_SIZES);
        saveSizes(DEFAULT_SIZES);
    };

    const sectionStyle = i => (collapsed[i] ? {flex: '0 0 auto', minHeight: 0} : {flexGrow: sizes[i]});

    const panelClass = ['section-line-break', 'section-check', 'section-mask', 'section-copy'];
    const panelTitle = i => [titles.lineBreak, titles.checkType, titles.mask, titles.copyStyle][i];
    const renderPanel = i => {
        if (i === 0) return <LineBreakPanel bindings={bindings} recordingRef={recordingRef} onKeysStatus={setKeysStatus} blockKeys={blockKeys} />;
        if (i === 1) return <CheckTypePanel />;
        if (i === 2) return <MaskImagesPanel />;
        return <CopyStylePanel />;
    };
    const layout = {
        items: order.map(i => ({index: i, title: panelTitle(i), hidden: hidden[i]})),
        onMove: movePanel,
        onToggle: toggleHidden,
    };

    return (
        <div className="app">
            <header className="app-header">
                <span className="app-title">Typertool</span>
                <button
                    type="button"
                    className={'app-gear' + (showShortcuts ? ' is-on' : '')}
                    title={shortcutText.open}
                    onClick={() => setShowShortcuts(on => !on)}
                >
                    <FiSettings size={14} />
                    <span>{shortcutText.open}</span>
                </button>
            </header>
            <div className="app-body">
            <div className="app-sections">
                {visible.length ? visible.map((panel, position) => (
                    <React.Fragment key={panel}>
                        {position > 0 ? <Splitter onStart={startDrag(position - 1)} onReset={resetSizes} disabled={!dragPair(position - 1)} /> : null}
                        <Section
                            title={panelTitle(panel)}
                            className={panelClass[panel]}
                            style={sectionStyle(panel)}
                            sectionRef={el => { sectionRefs.current[panel] = el; }}
                            collapsed={collapsed[panel]}
                            onToggle={() => toggleCollapsed(panel)}
                        >
                            {renderPanel(panel)}
                        </Section>
                    </React.Fragment>
                )) : <div className="app-empty">{titles.allHidden}</div>}
            </div>
            {showShortcuts ? (
                <ShortcutSettings
                    bindings={bindings}
                    setBindings={setBindings}
                    recordingRef={recordingRef}
                    keysStatus={keysStatus}
                    blockKeys={blockKeys}
                    setBlockKeys={setBlockKeys}
                    layout={layout}
                    onClose={() => setShowShortcuts(false)}
                />
            ) : null}
            </div>
        </div>
    );
};

createRoot(document.getElementById('root')).render(<App />);
