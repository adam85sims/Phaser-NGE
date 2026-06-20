import net from 'net';
import { spawn } from 'child_process';

async function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findFreePort(startPort + 1));
      } else {
        reject(err);
      }
    });
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function main() {
  const port = await findFreePort(3000);
  if (port !== 3000) {
    console.log(`[dev-runner] Port 3000 is busy, using closest available port: ${port}`);
  }
  
  const env = { ...process.env, PORT: port.toString(), VITE_ELECTRON: 'true' };
  
  // Launch vite and electron using concurrently
  const child = spawn('npx', ['concurrently', '-k', '"vite"', `"wait-on tcp:${port} && electron ."`], {
    env,
    stdio: 'inherit',
    shell: true
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main();
