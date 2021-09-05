import postcss from "postcss";
import getPlugin from "./plugin";

export default function loader(source) {
  const callback = this?.async();
  this?.cacheable();

  try {
    const pcOptions = {
      to: this?.resourcePath,
      from: this?.resourcePath,
    };

    const { PostcssPlugin } = getPlugin({
      loaderContext: this,
    });
    postcss(PostcssPlugin)
      .process(source, pcOptions)
      .then((result) => {
        const map = result.map && result.map.toJSON();
        callback(null, result.css, map);
      })
      .catch((error) => {
        callback(error);
      });
  } catch (err) {
    callback(err);
  }
}
