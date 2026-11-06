import './maskImagesPanel.scss';

import React from 'react';
import {FiX, FiPlus} from 'react-icons/fi';
import {MdOutlineContentCut, MdOutlineLayers} from 'react-icons/md';

import {locale, nativeAlert, applyImageToLayer} from '../../utils';

// Personal build: this panel takes the place of the Styles panel. A list of
// png/jpg images (thumbnail + name, like Photoshop's layers) and the buttons
// that turn the picked one into a mask of the selected layer.

const STORAGE_KEY = 'typerMaskImages';

const baseName = path => String(path || '').split(/[\\/]/).pop();
const displayName = path => baseName(path).replace(/\.[^.]*$/, '');
const fileUrl = path => 'file:///' + encodeURI(String(path || '').replace(/\\/g, '/')).replace(/^\/+/, '').replace(/#/g, '%23');

const loadImages = () => {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list.filter(path => typeof path === 'string') : [];
    } catch (error) {
        return [];
    }
};

const saveImages = paths => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
    } catch (error) {}
};

const MaskImagesPanel = React.memo(function MaskImagesPanel() {
    const [images, setImages] = React.useState(loadImages);
    const [selected, setSelected] = React.useState(() => loadImages()[0] || '');
    const [busy, setBusy] = React.useState('');
    const fileInputRef = React.useRef(null);

    const update = next => {
        setImages(next);
        saveImages(next);
    };

    const pickFiles = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const addFiles = fileList => {
        const files = Array.from(fileList || []).filter(file => file.path && /\.(png|jpe?g)$/i.test(file.name));
        if (!files.length) return;
        const added = files.map(file => file.path).filter(path => !images.includes(path));
        if (added.length) update(images.concat(added));
        if (!selected) setSelected(files[0].path);
    };

    const onDrop = e => {
        if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
        e.preventDefault();
        e.stopPropagation();
        addFiles(e.dataTransfer.files);
    };

    const removeImage = (path, e) => {
        e.stopPropagation();
        const next = images.filter(item => item !== path);
        update(next);
        if (selected === path) setSelected(next[0] || '');
    };

    const run = (mode, invert) => {
        if (!selected || busy) return;
        setBusy(mode + (invert ? '-outer' : ''));
        applyImageToLayer(selected, mode, result => {
            setBusy('');
            if (result && result.error) {
                const key = {
                    noDocument: locale.maskImagesErrorNoDocument,
                    backgroundLayer: locale.maskImagesErrorBackground,
                    emptyLayer: locale.maskImagesErrorEmptyLayer,
                    notFound: locale.maskImagesErrorNotFound,
                    emptyImage: locale.maskImagesErrorEmptyImage,
                }[result.error];
                nativeAlert((key || locale.maskImagesError) + (result.message ? '\n' + result.message : ''), locale.errorTitle, true);
            }
        }, !!invert);
    };

    return (
        <div className="mip" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
            <input
                type="file"
                multiple
                accept=".png,.jpg,.jpeg"
                ref={fileInputRef}
                style={{display: 'none'}}
                onChange={e => addFiles(e.target.files)}
            />
            <div className="mip-list">
                {images.length ? images.map(path => (
                    <div
                        key={path}
                        className={'mip-row' + (path === selected ? ' is-selected' : '')}
                        onClick={() => setSelected(path)}
                        title={path}
                    >
                        <div className="mip-thumb">
                            <img src={fileUrl(path)} alt="" draggable="false" />
                        </div>
                        <div className="mip-name">{displayName(path)}</div>
                        <button
                            type="button"
                            className="topcoat-icon-button--quiet mip-remove"
                            title={locale.maskImagesRemove}
                            onClick={e => removeImage(path, e)}
                        >
                            <FiX size={13} />
                        </button>
                    </div>
                )) : (
                    <div className="mip-empty">{locale.maskImagesEmpty}</div>
                )}
            </div>
            <div className="mip-actions hostBrdTopContrast">
                <button
                    type="button"
                    className="topcoat-button--large mip-btn mip-add"
                    onClick={pickFiles}
                >
                    <FiPlus size={14} /> {locale.maskImagesAdd}
                </button>
                <button
                    type="button"
                    className="topcoat-button--large--cta mip-btn"
                    disabled={!selected || !!busy}
                    title={locale.maskImagesCreateMaskDescr}
                    onClick={e => run('mask', e.altKey)}
                >
                    <MdOutlineContentCut size={14} /> {locale.maskImagesCreateMask}
                </button>
                <button
                    type="button"
                    className="topcoat-button--large mip-btn"
                    disabled={!selected || !!busy}
                    title={locale.maskImagesCreateMaskOuterDescr}
                    onClick={() => run('mask', true)}
                >
                    <MdOutlineContentCut size={14} /> {locale.maskImagesCreateMaskOuter}
                </button>
                <button
                    type="button"
                    className="topcoat-button--large mip-btn"
                    disabled={!selected || !!busy}
                    onClick={() => run('clip')}
                >
                    <MdOutlineLayers size={14} /> {locale.maskImagesClip}
                </button>
            </div>
        </div>
    );
});

export default MaskImagesPanel;
