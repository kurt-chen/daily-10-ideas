const fs = require('fs');

const text = fs.readFileSync('.env', 'utf8');
const key = text.match(/^DEEPSEEK_API_KEY=(.*)$/m)?.[1]?.trim();

fetch('https://api.deepseek.com/models', {
  headers: {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  },
})
  .then(async (response) => {
    console.log(response.status);
    console.log((await response.text()).slice(0, 240));
  })
  .catch((error) => {
    console.error(`${error.name}: ${error.message}`);
    if (error.cause) {
      console.error(error.cause);
    }
    process.exit(1);
  });
