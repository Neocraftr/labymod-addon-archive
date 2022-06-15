const fs = require('fs');
const fsPromise = fs.promises;
const axios = require('axios');
const winston = require('winston');
const { program } = require('commander');

const ADDON_LIST_URL = 'https://dl.labymod.net/addons.json';
const ADDON_DOWNLOAD_URL = 'https://dl.labymod.net/latest/?file=%s&a=1';
const ADDON_ICON_URL = 'https://dl.labymod.net/latest/addons/%s/icon.png';


const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
        winston.format.printf(info => `${info.timestamp} ${info.level} - ${info.message}`)
    ),
    transports: [
        new winston.transports.Console()
    ]
});

if(!fs.existsSync('./data/')) {
    fs.mkdirSync('./data');
}
if(!fs.existsSync('./data/addons/')) {
    fs.mkdirSync('./data/addons');
}
if(!fs.existsSync('./data/archive.json')) {
    fs.writeFileSync('./data/archive.json', JSON.stringify({addons:{}}));
}
let archiveFile = JSON.parse(fs.readFileSync('./data/archive.json'));

program
    .name('node src/main.js')
    .description('Bot to archive addons from the LabyMod store.')
    .version('1.0.0')
    .showHelpAfterError(true)
    .option('-u, --update', 'update archived list of addons')
    .option('-l, --list', 'print list of archived addons')
    .option('-s, --show <uuid>', 'show all information for specified addon');

if(process.argv.length < 3) {
    program.help();
}
program.parse();

const options = program.opts();
if(options.update) {
    updateArchive();
} else if(options.list) {
    for(version of Object.keys(archiveFile.addons)) {
        console.log(`LabyMod ${version.replace(/^(\d{1})(\d+)$/, '$1.$2')}:`);
        for(addon of archiveFile.addons[version]) {
            console.log(`- ${addon.name} by ${addon.author} [${addon.uuid}] ${addon.isDeleted ? '(deleted)' : ''}`);
        }
    }
} else if(options.show) {
    const addon = getAddonById(options.show);
    if(addon) {
        console.log(addon);
    } else {
        console.log(`Addon with UUID "${options.show}" not found.`);
    }
} else {
    program.help();
}

function updateArchive() {
    logger.info('Downloading addon list...');
    axios.get(ADDON_LIST_URL).then(async res => {
        for(version of Object.keys(res.data.addons)) {
            if(!archiveFile.addons[version]) {
                archiveFile.addons[version] = [];
            }
    
            // new addons + updates
            logger.info(`Checking for new/updated addons (MC ${version.replace(/^(\d{1})(\d+)$/, '$1.$2')})...`);
            for(addon of res.data.addons[version]) {
                const savedAddonIndex = archiveFile.addons[version].findIndex(i => i.uuid == addon.uuid);
                let savedAddonInfo = archiveFile.addons[version][savedAddonIndex];
                const addonDataDir = `./data/addons/mc${version}/${addon.uuid}`;
    
                addon.isDeleted = false;
                addon.category = res.data.categories[addon.category - 1];
    
                if(!savedAddonInfo) {
                    logger.info(`Found new addon ${addon.name} by ${addon.author} [mc${version}/${addon.uuid}]`);
                    archiveFile.addons[version].push(addon);
                    
                    await fsPromise.mkdir(addonDataDir, {recursive: true});
                    await downloadFile(ADDON_ICON_URL.replace('%s', addon.uuid), addonDataDir+'/icon.png');
                    await downloadFile(ADDON_DOWNLOAD_URL.replace('%s', addon.uuid), `${addonDataDir}/${addon.name}-v${addon.version}.jar`);
                } else if(savedAddonInfo.version != addon.version) {
                    logger.info(`Found update for addon ${addon.name} by ${addon.author} [mc${version}/${addon.uuid}] v${savedAddonInfo.version} -> v${addon.version}`);
                    archiveFile.addons[version][savedAddonIndex] = addon;
                    
                    await downloadFile(ADDON_DOWNLOAD_URL.replace('%s', addon.uuid), `${addonDataDir}/${addon.name}-v${addon.version}.jar`);
                } else if(savedAddonInfo.isDeleted) {
                    archiveFile.addons[version][savedAddonIndex].isDeleted = false;
                }
            }
    
            // deleted addons
            logger.info(`Checking for deleted addons (MC ${version.replace(/^(\d{1})(\d+)$/, '$1.$2')})...`);
            archiveFile.addons[version].forEach((savedAddonInfo, savedAddonIndex) => {
                if(savedAddonInfo.isDeleted) return;
                if(res.data.addons[version].findIndex(i => i.uuid == savedAddonInfo.uuid && i.name == savedAddonInfo.name) == -1) {
                    logger.info(`Found deleted addon ${savedAddonInfo.name} by ${savedAddonInfo.author} [mc${version}/${savedAddonInfo.uuid}]`);
                    archiveFile.addons[version][savedAddonIndex].isDeleted = true;
                }
            });
        }
        await fsPromise.writeFile('./data/archive.json', JSON.stringify(archiveFile));
    });
}

async function downloadFile(url, path) {
    return axios.get(url, {responseType: 'stream'}).then(res => {
        res.data.pipe(fs.createWriteStream(path));
    }).catch(err => {
        logger.error(`Can not download from "${url}": ${err.message}`);
    });
}

function getAddonById(uuid) {
    for(version of Object.keys(archiveFile.addons)) {
        for(addon of archiveFile.addons[version]) {
            if(addon.uuid == uuid) return addon;
        }
    }
    return null;
}
