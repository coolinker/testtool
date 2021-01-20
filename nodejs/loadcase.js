const fs = require('fs');

const loadCase = (caseName = "Case") => {
    const fileName = `${caseName}.json`;
    return new Promise((resolve, reject) => {
        fs.readFile(`${fileName}`, 'utf8' , (err, data) => {
            if (err) {
              console.error(err)
              reject(err);
            }
            console.log(data.substring(0, 100));    
            resolve(JSON.parse(data));
          });
    });
}

module.exports = loadCase;
