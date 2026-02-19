let tail = Promise.resolve();

const withExcelNativeLock = (task) => {
  const run = tail.then(() => task());
  tail = run.catch(() => {});
  return run;
};

module.exports = { withExcelNativeLock };
