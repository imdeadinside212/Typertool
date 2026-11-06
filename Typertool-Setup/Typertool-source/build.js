// Builds the extension folder dist/Typertool
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");
const sass = require("sass");

const root = __dirname;
const out = path.join(root, "dist", "Typertool");
fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });
for (const dir of ["js", "css", "jsx", "CSXS"]) fs.mkdirSync(path.join(out, dir), { recursive: true });

// scss imported from the components is compiled by a small plugin and gathered in one css file
const cssParts = [];
const scssPlugin = {
  name: "scss",
  setup(build) {
    // The image mask panel is copied unchanged from TypeR and imports its helpers from "../../utils"
    build.onResolve({ filter: /^\.\.\/\.\.\/utils$/ }, () => ({ path: path.join(root, "src/shim/utils.js") }));
    build.onLoad({ filter: /\.scss$/ }, (args) => {
      cssParts.push(sass.compile(args.path, { style: "compressed" }).css);
      return { contents: "", loader: "js" };
    });
  },
};

esbuild.build({
  entryPoints: [path.join(root, "src/index.jsx")],
  bundle: true,
  minify: true,
  target: ["chrome58"],
  outfile: path.join(out, "js/bundle.js"),
  loader: { ".js": "jsx", ".jsx": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [scssPlugin],
  logLevel: "warning",
}).then(() => {
  fs.writeFileSync(path.join(out, "css/bundle.css"), cssParts.join("\n"));
  fs.copyFileSync(path.join(root, "index.html"), path.join(out, "index.html"));
  // the key watcher the panel starts (see src/lib/globalKeys.js)
  fs.mkdirSync(path.join(out, "keys"), { recursive: true });
  for (const file of ["KeyWatcher.cs", "typertool-keys.ps1"]) fs.copyFileSync(path.join(root, "ext/keys", file), path.join(out, "keys", file));
  fs.copyFileSync(path.join(root, "src/shim/CSInterface.js"), path.join(out, "js/CSInterface.js"));
  console.log("panel built");
}).catch(() => process.exit(1));
