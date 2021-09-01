module.exports = async (content) => {
  const callback = this.async();
  callback(null, content);
}