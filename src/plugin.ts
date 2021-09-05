import { PluginCreator, Rule } from "postcss";
import valueParser, { FunctionNode } from "postcss-value-parser";
export default ({ loaderContext }) => {
  const PostcssPlugin: PluginCreator<{}> = function () {
    return {
      postcssPlugin: "webp-connvert-parser",
      async Declaration(decl) {
        if (decl.prop === "background" || decl.prop === "background-image") {
          const { nodes } = valueParser(decl.value);
          nodes.forEach((ele) => {
            if (ele.value === 'url') {
             const [ urlNode ] = (ele as FunctionNode).nodes;
             const url = urlNode.value;
            }
          })
        }
      },
    };
  }
  PostcssPlugin.postcss = true;
  return {
    PostcssPlugin,
  };
};
