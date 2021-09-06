import { Declaration, Node, PluginCreator, Rule } from "postcss";
import valueParser, { FunctionNode } from "postcss-value-parser";
import { transformAlias, startsWith } from "./util";
import * as path from "path";
import * as fs from "fs-extra";
import { ImagePool } from "@squoosh/lib";
import { url } from "inspector";
export default ({ loaderContext, options }) => {
  let { outputPath, className } = options;

  const compilerOptions = loaderContext._compiler.options;
  const _alias = compilerOptions.resolve.alias;
  const _context = compilerOptions.context || loaderContext.rootContext;

  const alias = transformAlias(_alias);

  let realOutput = outputPath;
  // if output path is match alias, transform into alias path
  for (const item of alias) {
    if (
      outputPath === item.name ||
      (!item.onlyModule && startsWith(outputPath, item.name + "/"))
    ) {
      if (
        outputPath !== item.alias &&
        !startsWith(outputPath, `${item.alias}/`)
      ) {
        realOutput = item.alias + outputPath.substr(item.name.length);
      }
    }
  }
  const result: Record<
    string,
    {
      url: string[];
      decl: Declaration;
      webpDecl: Declaration;
    }
  > = {};
  const targets = {
    ".png": "oxipng",
    ".jpg": "mozjpeg",
    ".jpeg": "mozjpeg",
    ".jxl": "jxl",
    ".webp": "webp",
    ".avif": "avif",
    // ...minifyOptions.targets,
  };
  console.log(outputPath, realOutput);
  fs.ensureDirSync(realOutput);
  const PostcssPlugin: PluginCreator<{}> = function () {
    return {
      postcssPlugin: "webp-connvert-parser",
      async Declaration(decl) {
        if (decl.prop === "background" || decl.prop === "background-image") {
          const { selector } = decl.parent as Rule;
          result[selector] = Object.assign(result[selector] || {}, {
            url: result[selector]?.url || [],
            decl,
            webpDecl: undefined,
          });
          const { nodes } = valueParser(decl.value);
          for (const node of nodes) {
            if (node.value === "url") {
              const [urlNode] = (node as FunctionNode).nodes;
              const url = urlNode.value;
              result[selector].url.push(url);
              try {
                const imagePath = await new Promise<string>((resolve, reject) =>
                  loaderContext.resolve(
                    loaderContext.context,
                    url,
                    (err, result) => (err ? reject(err) : resolve(result))
                  )
                );
                const ext = path.extname(imagePath).toLowerCase();
                const targetCodec = targets[ext];
                if (!targetCodec) {
                  throw new Error(
                    `The "${imagePath}" was not minified, ${ext} extension is not supported".`
                  );
                }
                const encodeOptions = {
                  [targetCodec]: {},
                  webp: {},
                  // ...minifyOptions.encodeOptions,
                };
                const imagePool = new ImagePool();
                const image = imagePool.ingestImage(imagePath);
                await image.decoded;
                await image.preprocess({
                  quant: {
                    numColors: 256,
                    dither: 0.5,
                  },
                });
                await image.encode(encodeOptions);
                //TODO: compare image size
                const rawImage = (await image.encodedWith[targetCodec]).binary;
                const rawImageInWebp = (await image.encodedWith.webp).binary;
                fs.outputFileSync(imagePath, rawImage);
                fs.outputFileSync(imagePath + ".webp", rawImageInWebp);
                await imagePool.close();
              } catch (err) {
                console.error(err);
                console.error(`${url} is not found`);
              }
            }
          }
        }
      },
      OnceExit(root, { Rule }) {
        //console.log(root)
        const nowebps = [];
        const webps = [];
        for (const item in result) {
          const norule = new Rule({ selector: `.${className.nowebp} ${item}` });
          norule.append(result[item].decl);
          nowebps.push(norule);

          let finalValue = result[item].decl.value;
          result[item].url.forEach((url) => {
            finalValue = finalValue.replace(url, url + ".webp");
          });
          result[item].webpDecl = result[item].decl.clone({
            value: finalValue,
          });

          console.log(result[item].webpDecl);

          const rule = new Rule({ selector: `.${className.webp} ${item}` });
          rule.append(result[item].webpDecl);
          webps.push(rule);
        }
        root.append([...nowebps, ...webps]);
      },
    };
  };
  PostcssPlugin.postcss = true;
  return {
    PostcssPlugin,
  };
};
