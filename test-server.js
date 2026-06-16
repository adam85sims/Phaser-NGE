import { startServer, setProjectRoot } from './src-main/server.js';

async function test() {
  const port = await startServer(3001, true);
  setProjectRoot('/home/adam/Documents/Dev/Phaser-NGE');
  
  const res = await fetch('http://127.0.0.1:3001/data/theme.json');
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body length:', text.length);
  process.exit(0);
}
test();
