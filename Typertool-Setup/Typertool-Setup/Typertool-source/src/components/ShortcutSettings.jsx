import './ShortcutSettings.scss';

import React from 'react';
import {FiX, FiEye, FiEyeOff, FiChevronUp, FiChevronDown} from 'react-icons/fi';

import {isVietnamese} from '../shim/utils';
import {COMMANDS, DEFAULT_BINDINGS, recordCombination, describeBinding, findConflicts} from '../lib/hotkeys';

export const shortcutText = isVietnamese ? {
    open: 'Cài đặt',
    tabShortcuts: 'Phím tắt',
    tabLayout: 'Bố cục giao diện',
    layoutHint: 'Đổi thứ tự các khung bằng nút Lên / Xuống. Nút con mắt ẩn hẳn khung (cả thanh tiêu đề) và tắt luôn: khung không chạy gì cho tới khi bạn bật lại.',
    moveUp: 'Lên',
    moveDown: 'Xuống',
    hide: 'Ẩn khung này (tắt hẳn)',
    show: 'Hiện lại khung này',
    title: 'Phím tắt chọn nhanh',
    hint: 'Đã có sẵn, không cần cài gì: bấm phím tắt (khi đang ở Photoshop) thì panel nhảy sang nút số dòng đó và dùng ngay option đầu tiên cho layer chữ đang chọn. "Vừa bong bóng" chọn option đẹp nhất nằm gọn trong phần tròn của bong bóng đang select và căn giữa chữ ở đó. Bấm Gán rồi nhấn tổ hợp phím (Esc để huỷ).',
    status: {
        starting: 'Đang khởi động bộ nghe phím…',
        active: 'Phím tắt đang hoạt động (chỉ khi Photoshop đang là cửa sổ chính)',
        activeHook: 'Phím tắt đang hoạt động: Photoshop KHÔNG nhận các phím này (không bị lẫn với phím tắt của Photoshop)',
        activePoll: 'Phím tắt đang hoạt động, nhưng Photoshop vẫn nhận các phím này (có thể bị lẫn với phím tắt của Photoshop)',
        off: 'Đang tắt: khung Ngắt dòng đang bị thu gọn hoặc ẩn',
        idle: 'Chưa có phím tắt nào được gán',
        unavailable: 'Không dùng được phím tắt toàn cục',
        stopped: 'Bộ nghe phím đã dừng',
    },
    fallback: 'Nếu không hoạt động (Mac, hoặc phần mềm diệt virus chặn PowerShell): vào Photoshop > Edit > Keyboard Shortcuts > Application Menus > File > Scripts và gán phím cho các script "Typertool - ..." (install_win.cmd đã chép sẵn vào đó).',
    block: 'Chặn các phím này khỏi Photoshop (tránh bị lẫn, vd Shift+F2 không kích hoạt thêm phím F2 của Photoshop). Tắt nếu phần mềm diệt virus báo.',
    best: 'Đẹp nhất',
    fit: 'Vừa bong bóng',
    lines: 'dòng',
    record: 'Gán',
    recording: 'Nhấn phím…',
    clear: 'Xoá',
    reset: 'Về mặc định',
    close: 'Đóng',
    conflict: 'Trùng phím với lệnh khác',
} : {
    open: 'Settings',
    tabShortcuts: 'Shortcuts',
    tabLayout: 'Interface layout',
    layoutHint: 'Change the order of the panels with Move up / Move down. The eye hides a panel completely (title bar included) and switches it off: it does nothing until you show it again.',
    moveUp: 'Move up',
    moveDown: 'Move down',
    hide: 'Hide this panel (switch it off)',
    show: 'Show this panel again',
    title: 'Quick shortcuts',
    hint: 'Ready to use, nothing to set up: press a shortcut (while Photoshop is active) and the panel jumps to that number of lines and applies its first option to the selected text layer. "Fit to bubble" applies the best option that fits the round part of the selected bubble and centers the text there. Click Record, then press the keys (Esc cancels).',
    status: {
        starting: 'Starting the key watcher…',
        active: 'Shortcuts are active (only while Photoshop is the active window)',
        activeHook: 'Shortcuts are active: Photoshop does NOT receive these keys (no mix-up with its own shortcuts)',
        activePoll: 'Shortcuts are active, but Photoshop still receives these keys (they can mix with its own shortcuts)',
        off: 'Off: the Line break panel is collapsed or hidden',
        idle: 'No shortcut is set',
        unavailable: 'Global shortcuts are not available',
        stopped: 'The key watcher stopped',
    },
    fallback: 'If they do not work (Mac, or an antivirus blocking PowerShell): in Photoshop open Edit > Keyboard Shortcuts > Application Menus > File > Scripts and give keys to the "Typertool - ..." scripts (install_win.cmd already copied them there).',
    block: 'Keep these keys away from Photoshop (no mix-up: Shift+F2 for "2 lines" does not also run what Photoshop has on F2). Turn off if an antivirus complains.',
    best: 'Best',
    fit: 'Fit to bubble',
    lines: 'lines',
    record: 'Record',
    recording: 'Press keys…',
    clear: 'Clear',
    reset: 'Defaults',
    close: 'Close',
    conflict: 'Same keys as another command',
};

// Full-panel settings sheet, opened from the header at the top of the tool
// The panels as small cards: the eye shows / hides (switches off) a panel, the buttons move it
const LayoutTab = ({layout, onClose}) => (
    <React.Fragment>
        <div className="ss-hint">{shortcutText.layoutHint}</div>
        <div className="ll-list">
            {layout.items.map((item, position) => (
                <div key={item.index} className={'ll-card' + (item.hidden ? ' is-hidden' : '')}>
                    <div className="ll-top">
                        <span className="ll-name">{item.title}</span>
                        <button
                            type="button"
                            className="ll-eye"
                            title={item.hidden ? shortcutText.show : shortcutText.hide}
                            aria-pressed={!item.hidden}
                            onClick={() => layout.onToggle(item.index)}
                        >
                            {item.hidden ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                        </button>
                    </div>
                    <div className="ll-moves">
                        <button type="button" className="ll-move ll-up" disabled={position === 0} onClick={() => layout.onMove(item.index, -1)}>
                            <FiChevronUp size={14} /> {shortcutText.moveUp}
                        </button>
                        <button type="button" className="ll-move ll-down" disabled={position === layout.items.length - 1} onClick={() => layout.onMove(item.index, 1)}>
                            <FiChevronDown size={14} /> {shortcutText.moveDown}
                        </button>
                    </div>
                </div>
            ))}
        </div>
        <div className="ss-foot">
            <button type="button" className="ss-btn ss-primary" onClick={onClose}>{shortcutText.close}</button>
        </div>
    </React.Fragment>
);

const ShortcutSettings = ({bindings, setBindings, onClose, recordingRef, keysStatus, blockKeys, setBlockKeys, layout}) => {
    const [tab, setTab] = React.useState('shortcuts');
    const [recording, setRecording] = React.useState('');
    const cancelRef = React.useRef(null);
    const conflicts = React.useMemo(() => findConflicts(bindings), [bindings]);

    React.useEffect(() => () => {
        if (cancelRef.current) cancelRef.current();
        recordingRef.current = false;
    }, []);

    const record = command => {
        if (cancelRef.current) cancelRef.current();
        recordingRef.current = true;
        setRecording(command);
        cancelRef.current = recordCombination(keys => {
            recordingRef.current = false;
            setRecording('');
            if (keys && keys.length) setBindings(Object.assign({}, bindings, {[command]: keys}));
        });
    };

    // leaving the shortcuts tab ends a recording that is still waiting for keys
    const switchTab = next => {
        if (next === tab) return;
        if (cancelRef.current) cancelRef.current();
        recordingRef.current = false;
        setRecording('');
        setTab(next);
    };

    const clear = command => {
        // an empty list, not a missing key: a missing one gets its default back when the keys are loaded
        setBindings(Object.assign({}, bindings, {[command]: []}));
    };

    return (
        <div className="ss">
            <div className="ss-head">
                <div className="ss-tabs">
                    <button type="button" className={'ss-tab ss-tab-shortcuts' + (tab === 'shortcuts' ? ' is-on' : '')} onClick={() => switchTab('shortcuts')}>{shortcutText.tabShortcuts}</button>
                    <button type="button" className={'ss-tab ss-tab-layout' + (tab === 'layout' ? ' is-on' : '')} onClick={() => switchTab('layout')}>{shortcutText.tabLayout}</button>
                </div>
                <button type="button" className="ss-close" title={shortcutText.close} onClick={onClose}><FiX size={16} /></button>
            </div>
            {tab === 'layout' ? <LayoutTab layout={layout} onClose={onClose} /> : (
            <React.Fragment>
            <div className="ss-hint">{shortcutText.hint}</div>
            <div className={'ss-state is-' + ((keysStatus && keysStatus.state) || 'off') + (keysStatus && keysStatus.detail === 'poll' ? ' is-open' : '')}>
                {keysStatus && keysStatus.state === 'active' && keysStatus.detail === 'hook' ? shortcutText.status.activeHook
                    : keysStatus && keysStatus.state === 'active' && keysStatus.detail === 'poll' ? shortcutText.status.activePoll
                        : shortcutText.status[(keysStatus && keysStatus.state) || 'off']}
                {keysStatus && keysStatus.detail && /^(stopped|unavailable)$/.test(keysStatus.state) ? ' (' + keysStatus.detail + ')' : ''}
            </div>
            <label className="ss-poll">
                <input type="checkbox" checked={!!blockKeys} onChange={event => setBlockKeys(event.target.checked)} />
                <span>{shortcutText.block}</span>
            </label>
            <div className="ss-list">
                {COMMANDS.map(command => (
                    <div key={command} className={'ss-row' + (conflicts[command] ? ' is-conflict' : '')} title={conflicts[command] ? shortcutText.conflict : ''}>
                        <span className="ss-name">{command === 'best' ? shortcutText.best : command === 'fit' ? shortcutText.fit : command + ' ' + shortcutText.lines}</span>
                        <span className={'ss-value' + (recording === command ? ' is-recording' : '')}>
                            {recording === command ? shortcutText.recording : describeBinding(bindings[command])}
                        </span>
                        <button type="button" className="ss-btn" onClick={() => record(command)}>{shortcutText.record}</button>
                        <button type="button" className="ss-btn" onClick={() => clear(command)}>{shortcutText.clear}</button>
                    </div>
                ))}
            </div>
            <div className="ss-steps">{shortcutText.fallback}</div>
            <div className="ss-foot">
                <button type="button" className="ss-btn" onClick={() => setBindings(Object.assign({}, DEFAULT_BINDINGS))}>{shortcutText.reset}</button>
                <button type="button" className="ss-btn ss-primary" onClick={onClose}>{shortcutText.close}</button>
            </div>
            </React.Fragment>
            )}
        </div>
    );
};

export default ShortcutSettings;
