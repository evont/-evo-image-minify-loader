import { Declaration, Node, PluginCreator, Rule } from "postcss";
import valueParser, { FunctionNode } from "postcss-value-parser";
import { transformAlias, startsWith} from "./util";

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
  const result: Record<string, {
    url: string[],
    decl: Declaration
  }> = {};
  const PostcssPlugin: PluginCreator<{}> = function () {
    return {
      postcssPlugin: "webp-connvert-parser",
      async Declaration(decl) {
        if (decl.prop === "background" || decl.prop === "background-image") {
          const { selector } = decl.parent as Rule;
          result[selector] = Object.assign(result[selector] || {}, {
            url: result[selector]?.url || [],
            decl
          })
          const { nodes } = valueParser(decl.value);
          nodes.forEach((ele) => {
            if (ele.value === 'url') {
             const [ urlNode ] = (ele as FunctionNode).nodes;
             const url = urlNode.value;
             result[selector].url.push(url)
            }
          })
        }
      },
      OnceExit(root, { Rule }) {
        //console.log(root)
        const nowebps = [];
        const webps = []
        for (const item in result) {
          const norule = new Rule({ selector: `.${className.nowebp} ${item}`,  })
          norule.append(result[item].decl);
          nowebps.push(norule);

          const rule = new Rule({ selector: `.${className.webp} ${item}`,  })
          rule.append(result[item].decl);
          nowebps.push(rule);
        }
        root.append([...nowebps, ...webps])
      }
    };
  }
  PostcssPlugin.postcss = true;
  return {
    PostcssPlugin,
  };
};
