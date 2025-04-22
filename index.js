const http = require('http');
const fs = require('fs');
const path = require('path');
const {Server} = require('socket.io');

const PORT = 3000;
const MUSIC_DIR = path.join(__dirname, 'musics');
const INFO_FILE = path.join(__dirname, 'info.json');
const MAX_FILE_SIZE = 26214400; // 25 Mo

const formidable = require('formidable');
const readline = require('node:readline');
const { exec } = require('child_process');

const server = http.createServer((req, res) => {
    if (!fs.existsSync(MUSIC_DIR)) {
        fs.mkdirSync(MUSIC_DIR);
    }
});
const io = new Server(server);

io.on('connection', (socket) => {
    console.log('a user connected');
});

server.on('request', (req, res) => {
    if (req.url === '/') {
        fs.readdir(MUSIC_DIR, (err, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Erreur interne du serveur');
                return;
            }
            let musicList = [];
            fs.readFile(INFO_FILE, (err, data) => {
                if (!err) {
                    try {
                        musicList = JSON.parse(data);
                    } catch (parseErr) {
                        console.error('Erreur lors de l\'analyse de info.json :', parseErr);
                    }
                }
                let html = '<h1>List</h1><ul>';
                files.forEach(file => {
                    if (file.endsWith('.mp3')) {
                        const musicInfo = musicList.find(info => info.path === file);
                        const name = musicInfo ? musicInfo.name : file;
                        html += `<li><a href="/musics/${file}">${name}</a></li>`;
                    }
                });
                html += '</ul>';
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
            });
        });
               
    } else if (req.url.startsWith('/musics/')) {
        const filePath = path.join(MUSIC_DIR, req.url.replace('/musics/', ''));
        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Fichier non trouvé');
            return;
            }

            res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': stats.size,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
            });
            const readStream = fs.createReadStream(filePath);
            readStream.pipe(res);
        });
        sendClientConsole(`File requested: ${req.url}; IP: ${req.socket.remoteAddress}`)
    } else if (req.url === '/infos') {
        fs.readFile(INFO_FILE, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Fichier info.js non trouvé');
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
        sendClientConsole(`Infos requested by ${req.socket.remoteAddress}`)
    } else if (req.url === '/upload' && req.method.toLowerCase() === 'post' && Admin) {
        const form = new formidable.IncomingForm();
        form.uploadDir = MUSIC_DIR;
        form.keepExtensions = true;
        form.maxFileSize = MAX_FILE_SIZE;

        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error('Erreur lors de l\'upload :', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Erreur lors de l\'upload');
                return;
            }

            if (files.file[0].size > MAX_FILE_SIZE) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Le fichier est trop gros (max 25 Mo)');
                return;
            }
        
            const uploadedFile = files.file[0];
            if (!uploadedFile.mimetype.startsWith('audio/') && !uploadedFile.mimetype.startsWith('video/')) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Le fichier uploadé n\'est ni un fichier audio ni une vidéo');
                return;
            }

            const isMp3 = path.extname(uploadedFile.originalFilename).toLowerCase() === '.mp3';
            const tempFilePath = uploadedFile.filepath;
            const convertedFilePath = `${tempFilePath}.mp3`;
            if (!isMp3) {
                
                
                if (!fs.existsSync(tempFilePath)) {
                    console.error('Le fichier temporaire n\'existe pas :', tempFilePath);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Erreur : le fichier temporaire est introuvable');
                    return;
                }
                exec(`ffmpeg -i "${tempFilePath}" -q:a 2 "${convertedFilePath}"`, (err) => {
                    if (err) {
                        console.error('Erreur de conversion avec ffmpeg :', err);
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Erreur lors de la conversion du fichier en MP3');
                        return;
                    }
                
                    fs.unlink(tempFilePath, (unlinkErr) => {
                        if (unlinkErr) {
                            console.error('Erreur lors de la suppression du fichier temporaire :', unlinkErr);
                        }
                    });
                    uploadedFile.filepath = convertedFilePath;
                    uploadedFile.originalFilename = `${path.basename(tempFilePath)}.mp3`;
                
                    processUploadedFile();
                });
            } else {
                fs.rename(uploadedFile.filepath, convertedFilePath, (renameErr) => {
                    if (renameErr) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Erreur lors de l\'enregistrement du fichier');
                        return;
                    }
                    processUploadedFile();
                });
                
            }

            function processUploadedFile() {
                 
                var fileName = convertedFilePath.split(path.sep).pop();
                const musicInfo = {
                    name: fields.name[0] || 'No name provided',
                    path: fileName
                };

                fs.readFile(INFO_FILE, (readErr, data) => {
                    let infos = [];
                    if (!readErr) {
                        try {
                            infos = JSON.parse(data);
                        } catch (parseErr) {
                            infos = [];
                        }
                    }

                    infos.push(musicInfo);

                    fs.writeFile(INFO_FILE, JSON.stringify(infos, null, 4), (writeErr) => {
                        if (writeErr) {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('Erreur lors de la mise à jour de info.json');
                            return;
                        }
                        // reload the page
                        res.writeHead(302, { Location: '/manage' });
                        res.end('Fichier uploadé avec succès');
                        
                    });
                });
                
            }

           
        });
    } else if (req.url === '/upload' && req.method.toLowerCase() === 'get' && Admin) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <h1>Uploader une musique</h1>
            <form action="/upload" method="post" enctype="multipart/form-data">
                <label for="file">Fichier :</label>
                <input type="file" name="file" id="file" required><br>
                <label for="name">Name :</label>
                <input type="text" name="name" id="name"><br>
                <button type="submit">Uploader</button>
            </form>
        `);
    
    } else if (req.url === '/delete' && req.method.toLowerCase() === 'post' && Admin) {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
    
        req.on('end', () => {
            console.log('Corps de la requête reçu :', body);
            const { _path } = JSON.parse(body);
            const name = _path
            console.log('Nom du fichier extrait :', name);
            const filePath = path.join(MUSIC_DIR, name);

            if (!fs.existsSync(filePath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Fichier non trouvé');
                return;
            }

            fs.unlink(filePath, (err) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Erreur lors de la suppression du fichier');
                    return;
                }

                fs.readFile(INFO_FILE, (readErr, data) => {
                    if (readErr) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Erreur lors de la lecture de info.json');
                        return;
                    }
        
                    let infos = [];
                    try {
                        infos = JSON.parse(data);
                    } catch (parseErr) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Erreur lors de l\'analyse de info.json');
                        return;
                    }
        
                    infos = infos.filter(info => info.path !== name);
        
                    fs.writeFile(INFO_FILE, JSON.stringify(infos, null, 4), (writeErr) => {
                        if (writeErr) {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('Erreur lors de la mise à jour de info.json');
                            return;
                        }
        
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('Fichier supprimé avec succès');
                    });
                });
            });
        });
    } else if (req.url === '/delete' && req.method.toLowerCase() === 'get' && Admin) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.readFile(path.join(__dirname, 'web/delete.html'), (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Erreur interne du serveur');
                return;
            }
            res.end(data);
        });
    } else if (req.url === '/manage' && req.method.toLowerCase() === 'get') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.readFile(path.join(__dirname, 'web/manage.html'), (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Erreur interne du serveur');
                return;
            }
            res.end(data);
        });
    }else if (req.url.startsWith('/assets/')) {
        const filePath = path.join(__dirname, req.url);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Fichier non trouvé');
                return;
            }
            const extname = path.extname(filePath);
            let contentType = 'text/html';
            switch (extname) {
                case '.js':
                    contentType = 'application/javascript';
                    break;
                case '.css':
                    contentType = 'text/css';
                    break;
                case '.png':
                    contentType = 'image/png';
                    break;
                case '.jpg':
                    contentType = 'image/jpg';
                    break;
                case '.gif':
                    contentType = 'image/gif';
                    break;
                default:
                    contentType = 'application/octet-stream';
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
       // envoyer le 404 uniquement si c'est un get 
    }else if (req.method.toLowerCase() === 'get') {
        if (req.url.startsWith('/socket.io/')){return}
        console.log(`404 Not Found: ${req.url}`);
        if (res.headersSent) {
            return;
        }
        fs.readFile(path.join(__dirname, 'web/404.html'), (err, data) => {
       
            if (err) {
                if (res.headersSent) {
                    return;
                }
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Erreur interne du serveur');
                return;
            }
            // envoyer uniquement si les headers ne sont pas déjà envoyés
            if (res.headersSent) {
                return;
            }
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    }
});

var Admin = false

server.listen(PORT, () => {
    MainMenu()
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
function AdminQuestion(){
    rl.question(`To change admin status type ON | OFF : `, name => {
        if (name.toUpperCase() === 'ON') {
            Admin = true
        } else if (name.toUpperCase() === 'OFF') {
            Admin = false
        }
        MainMenu()


    });
}
function PrintInfos() {
    console.log(` Music Manager V1.0`);
    console.log(` - `);
    console.log(`Server PORT ${PORT}`);
    console.log(`Server admin status: [${Admin && 'ON' || 'OFF'}]`);
    console.log(` - `);
}
function MainMenu(){
    console.clear();
    PrintInfos()
    console.log(`Main Menu`);
    console.log(`1. Toggle Admin status`);
    console.log(`2. Download playlist from Youtube`);
    console.log(`3. Download video from Youtube`);
    console.log(`4. Exit`);
    rl.question(`Choose an option: `, name => {
        if (name === '1') {
            AdminQuestion()
        } else if (name === '2') {

            rl.question(`Enter the Youtube URL: `, url => {
                if (url) {
                   
                    console.log(`Downloading ${url}...`);
                    exec(`start cmd /c ytdl.bat "${url}"`, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`Error: ${error.message}`);
                            anykey() 
                            return;
                        }
                        if (stderr) {
                            console.error(`stderr: ${stderr}`);
                            anykey() 
                            return;
                        }
                        console.log(`stdout: ${stdout}`);
                        anykey() 
                        
                    });
                    
                    
                } else {
                    console.log(`No URL provided`);
                    anykey() 
                }
                
            });
        } else if (name === '3') {
            rl.question(`Enter the Youtube URL: `, url => {
                if (url) {
                    console.log(`Downloading ${url}...`);
                    exec(`start cmd /c ytdl.bat "${url}" unique`, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`Error: ${error.message}`);
                            anykey() 
                            return;
                        }
                        if (stderr) {
                            console.error(`stderr: ${stderr}`);
                            anykey() 
                            return;
                        }
                        console.log(`stdout: ${stdout}`);
                        anykey() 
                        
                    });
                } else {
                    console.log(`No URL provided`);
                    anykey() 
                }
                
            });
           
        } else if (name === '4') {
            console.clear();
            console.log(`Exiting...`);
            server.close(() => {
                console.log(`Server closed`);
                process.exit(0);
            });
           
        }else {
            MainMenu();
        }
    });
}
function anykey() {
    console.log(`Press any key to continue...`);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', function (buf) {
        process.stdin.setRawMode(false);
        MainMenu()
    });
    
}
function sendClientConsole(message) {
    io.emit('console', message);
}