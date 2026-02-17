const fs = require('fs');
const _ = require('lodash');

const tokens = JSON.parse(
  fs.readFileSync('./00_input/color-tokens.json', 'utf-8')
);

const modes = Object.entries(tokens.modes).map(([id, name]) => ({ id, name }));

modes.forEach((mode) => {
  const tokensProcessed = tokens.variables.reduce((acc, variable) => {
    const value = variable.resolvedValuesByMode[mode.id];
    const rgbString = ['r', 'g', 'b', 'a']
      .map((key) =>
        Math.round(value.resolvedValue[key] * (key === 'a' ? 100 : 255))
      )
      .join(',');
    const color = `rgba(${rgbString})`;

    // Custom setter that preserves numeric keys as object properties
    const path = variable.name.split('/');
    let current = acc;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = color;

    return acc;
  }, {});

  fs.writeFileSync(
    `../src/styles/color-tokens-${mode.name}.json`,
    JSON.stringify(tokensProcessed)
  );
});
