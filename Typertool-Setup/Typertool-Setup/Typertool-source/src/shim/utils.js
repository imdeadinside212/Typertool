// What the Image mask panel (copied unchanged from TypeR) and the other panels
// need from the host application.
/* global CSInterface */

export const csInterface = new CSInterface();

export const safeJsonParse = (value, fallback = {}) => {
  try {
    const parsed = JSON.parse(value);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (error) {
    return fallback;
  }
};

// One ExtendScript call, as a promise (never rejects, "" when it times out)
export const evalHost = (script, timeout = 30000) => new Promise((resolve) => {
  let done = false;
  const timer = setTimeout(() => {
    if (done) return;
    done = true;
    resolve("");
  }, timeout);
  csInterface.evalScript(script, (result) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    resolve(result);
  });
});

const vietnamese = /^vi/i.test(String((csInterface.hostEnvironment && csInterface.hostEnvironment.appUILocale) || navigator.language || ""));

const english = {
  errorTitle: "Error",
  maskImagesAdd: "Add images",
  maskImagesRemove: "Remove from list",
  maskImagesEmpty: "No images yet. Add png or jpg files.",
  maskImagesCreateMask: "Inner mask",
  maskImagesCreateMaskDescr: "Like the Add Layer Mask button with the image selected: shape white, outside black (Alt = outer mask)",
  maskImagesCreateMaskOuter: "Outer mask",
  maskImagesCreateMaskOuterDescr: "Like Alt+Add Layer Mask: shape black, outside stays white",
  maskImagesClip: "Clipping mask",
  maskImagesError: "Could not apply the image.",
  maskImagesErrorNoDocument: "Open a document first.",
  maskImagesErrorBackground: "Select a layer that is not the Background layer.",
  maskImagesErrorEmptyLayer: "The selected layer is empty.",
  maskImagesErrorNotFound: "The image file was not found.",
  maskImagesErrorEmptyImage: "The image has no visible pixels (use a PNG with a transparent background).",
};

const vietnameseStrings = {
  errorTitle: "Lỗi",
  maskImagesAdd: "Thêm ảnh",
  maskImagesRemove: "Xoá khỏi danh sách",
  maskImagesEmpty: "Chưa có ảnh. Hãy thêm file png hoặc jpg.",
  maskImagesCreateMask: "Mask trong",
  maskImagesCreateMaskDescr: "Như nút Add Layer Mask khi có vùng chọn của ảnh: vùng ảnh trắng, bên ngoài đen (Alt = mask ngoài)",
  maskImagesCreateMaskOuter: "Mask ngoài",
  maskImagesCreateMaskOuterDescr: "Như Alt+Add Layer Mask: vùng ảnh đen, bên ngoài trắng giữ nguyên",
  maskImagesClip: "Clipping mask",
  maskImagesError: "Không áp dụng được ảnh.",
  maskImagesErrorNoDocument: "Hãy mở một document trước.",
  maskImagesErrorBackground: "Hãy chọn layer không phải layer Background.",
  maskImagesErrorEmptyLayer: "Layer đang chọn trống.",
  maskImagesErrorNotFound: "Không tìm thấy file ảnh.",
  maskImagesErrorEmptyImage: "Ảnh không có vùng nhìn thấy nào (cần PNG nền trong suốt).",
};

export const locale = vietnamese ? vietnameseStrings : english;
export const isVietnamese = vietnamese;

export const nativeAlert = (message, title, isError) => {
  csInterface.evalScript(
    "alert(" + JSON.stringify(String(message)) + "," + JSON.stringify(String(title || "")) + "," + (isError ? "true" : "false") + ")"
  );
};

export const applyImageToLayer = (path, mode, callback, invert = false) => {
  csInterface.evalScript(
    "applyImageToLayer(" + JSON.stringify({ path: String(path || ""), mode, invert: !!invert }) + ")",
    (data) => callback(safeJsonParse(data, { error: "parseFailed" }))
  );
};
