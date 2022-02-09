const express = require('express');
const {stringify} = require("querystring");
const util = require("util");
const {createReadStream, constants: fsc} = require("fs");
const fs = require("fs/promises");
const path = require('path');
const mime = require("mime-types");
const sharp = require("sharp");
const router = express.Router();
const readline = require('readline');
const Feed = require('feed').Feed;
const isPromise = require('is-promise');

let cache = crawlDir("images/");

async function awaitCache() {
    if (isPromise(cache)) {
        cache = await cache;
    }
    return cache;
}

async function refreshCache() {
    cache = await crawlDir("images/");
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

async function readCropData(dat_path, resolution = null) {
    try {
        let fileStream = createReadStream(dat_path);
        let out = [];
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        for await (const line of rl) {
            let split = line.split(/, ?/);
            if (resolution === null || parseInt(split[2]) >= parseInt(resolution[0])) {
                out.push({
                    left: split[0],
                    top: split[1],
                    width: split[2],
                    height: split[3]
                });
            }
        }
        return out;
    } catch {
        return [];
    }
}

async function getInfo(filepath, resolution = null) {
    let out = {};
    let parsedPath = path.parse(filepath);
    {
        const data = await sharp(filepath, {limitInputPixels: false}).metadata();
        out = {
            ...out, ...{
                format: data.format,
                width: data.width,
                height: data.height
            }
        };
        if (resolution) {
            let ratio = reduce(resolution[0], resolution[1]);
            let dat_path = `${parsedPath.dir}/${parsedPath.name}.${ratio[0]}x${ratio[1]}.csv`;
            try {
                let data = await readCropData(dat_path, resolution);
                if (data.length > 0) {
                    out.crops = data;
                }
            } catch (err) {
                console.log(err);
            }
        } else {
            const files = await fs.readdir(parsedPath.dir);
            const regex = new RegExp(`^${escapeRegExp(parsedPath.name)}\\.\\d+x\\d+$`);
            for (const file of files) {
                let file_ext = path.extname(file);
                let file_name = path.parse(file).name;
                if (file_ext === ".csv" && regex.test(file_name)) {
                    let data = await readCropData(parsedPath.dir + "/" + file, resolution);
                    if (data.length > 0) {
                        if (!out.crops) {
                            out.crops = {};
                        }
                        out.crops[file_name.split('.').slice(-1)[0]] = data;
                    }
                }
            }
        }
    }
    return out;
}

async function crawlDir(dirpath, flat = false, root = true, depth = -1, min_width = 0, min_height = 0, cropped = false) {
    let {dir: parent, name} = path.parse(dirpath);
    if (depth === 0) {
        let wrap = {};
        wrap[name] = "Directory";
        return wrap;
    }
    let entries = await fs.readdir(dirpath, {withFileTypes: true});
    let out = {}
    const resolution = min_width && min_height ? [min_width, min_height] : null;
    for (const entry of entries) {
        let parsedPath = path.parse(entry.name);
        if (flat) {
            parsedPath.name = dirpath + parsedPath.name;
        }
        if (entry.isDirectory() || entry.isSymbolicLink()) {
            if (out[parsedPath.name]) {
                throw Error(`Duplicate keys names ${parsedPath.name} in ${dirpath}`);
            }
            out = {
                ...out, ...(await crawlDir(
                    `${dirpath}${entry.name}/`,
                    flat,
                    false,
                    (depth > 0) ? (depth - 1) : (-1),
                    min_width,
                    min_height,
                    cropped
                ))
            };
        } else if (parsedPath.ext && mime.lookup(parsedPath.ext).startsWith("image")) {
            if (out[parsedPath.name]) {
                throw Error(`Duplicate keys names ${parsedPath.name} in ${dirpath}`);
            }
            if (entry.isFile()) {
                try {
                    let info = await getInfo(`${dirpath}${entry.name}`, resolution);
                    if ((!min_width || info.width >= min_width) && (!min_height || info.height >= min_height) && (!cropped || info.crops)) {
                        out[parsedPath.name] = info;
                    }
                } catch (err) {
                    console.log(`${dirpath}${entry.name}`);
                    console.log(err);
                }
            }
        }
    }
    if (root || flat) {
        return out;
    } else {
        let wrap = {};
        wrap[name] = out;
        return wrap;
    }
}

async function fetchCache(dirpath) {
    /*if (cache === undefined) {
        cache = crawlDir("images")
    }*/
    return dirpath
        .split("/")
        .splice(1)
        .filter(element => {
            return element !== '';
        })
        .reduce((out, entry) => {
            console.log(entry);
            console.log(out[entry]);
            return out[entry];
        }, await awaitCache());
}

function flattenCache(target, parent = undefined) {
    let out = {};
    Object.entries(target).forEach(entry => {
        let [key, value] = entry;
        const outpath = parent === undefined ? key : `${parent}/${key}`;
        if (value === "Directory") {
            // Skip
        } else if (value.format === undefined) {
            out = {...out, ...flattenCache(value, outpath)}
        } else {
            out[outpath] = value;
        }
    });
    return out;
}

function filterCache(target, min_width = 0, min_height = 0, cropped = false) {
    let out = {};
    Object.entries(target).forEach(entry => {
        let [key, value] = entry;
        if (value.format === undefined) {
            let filtered = filterCache(value, min_width, min_height, cropped);
            if (Object.keys(filtered).length !== 0) {
                out[key] = filtered;
            }
        } else if (value.width >= min_width && value.height >= min_height && (/*!cropped ||*/ value.crops !== undefined)) {
            let copy = {...value};
            if (min_width > 0 && min_height > 0/* && cropped*/) {
                let ratio = reduce(min_width, min_height);
                let ratiostr = `${ratio[0]}x${ratio[1]}`;
                copy.crops = copy.crops.hasOwnProperty(ratiostr) ? copy.crops[ratiostr] : undefined;
            }
            if (!cropped || copy.crops !== undefined) {
                out[key] = copy;
            }
        }
    });
    return out;
}

function truncateCache(target, depth) {
    if (depth === 0) {
        return "Directory";
    }
    let out;
    Object.entries(target).forEach(entry => {
        let [key, value] = entry;
        if (value.format === undefined) {
            out[key] = truncateCache(value, depth - 1);
        } else {
            out[key] = value;
        }
    });
    return out;
}

async function crawlCache(dirpath, flat = false, root, depth = -1, min_width = 0, min_height = 0, cropped = false) {
    let out = await fetchCache(dirpath);
    if (min_width > 0 || min_height > 0 || cropped) {
        out = filterCache(out, min_width, min_height, cropped);
    }
    if (depth >= 0) {
        out = truncateCache(out, depth);
    }
    if (flat) {
        out = flattenCache(out, dirpath);
    }
    return out;
}

async function getDir(req, res, next) {
    const reqpath = decodeURI(req.path);
    try {
        res.type(mime.lookup("json"));
        res.send(JSON.stringify(await crawlCache(
            `images${reqpath}/`,
            req.query.flat !== undefined && req.query.flat !== "false",
            true,
            req.query.depth !== undefined ? parseInt(req.query.depth) : -1,
            req.query.min_width !== undefined ? parseInt(req.query.min_width) : 0,
            req.query.min_height !== undefined ? parseInt(req.query.min_height) : 0,
            req.query.cropped !== undefined && req.query.cropped !== "false"
        )));
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
}

async function findImage(reqpath) {
    let {dir, ext: ext_out, name} = path.parse(reqpath);
    dir = `images${dir}`
    let ext_in = ext_out;
    try {
        await fs.access(`images${reqpath}`, fsc.F_OK | fsc.R_OK);
    } catch (err) {
        const files = await fs.readdir(dir);
        for (const file of files) {
            let ext = path.extname(file);
            if (ext !== "csv" && path.parse(file).name === name) {
                ext_in = ext;
            }
        }
        if (ext_in === ext_out) {
            throw "Not found"
        }
        await fs.access(`${dir}/${name}${ext_in}`, fsc.F_OK | fsc.R_OK);
    }
    return ext_in;
}

async function getImage(req, res, next) {
    const reqpath = decodeURI(req.path);
    console.log(reqpath);
    const query = req.query;
    let {dir, ext: ext_out, name} = path.parse(reqpath);
    dir = `images${dir}`
    let ext_in;
    const isThumb = query.length === 1 && query.width && query.width === 100;
    try {
        ext_in = await findImage(reqpath);
        if (ext_out.length === 0) {
            ext_out = ext_in;
        }
    } catch (e) {
        console.log(e);
        res.sendStatus(404);
        return;
    }
    try {
        if (query.info !== undefined && query.info !== "false") {
            res.type(mime.lookup("json"));
            res.send(await getInfo(`${dir}/${name}${ext_in}`, query.width && query.height ? [query.width, query.height] : null));
            return;
        }

        let img = await sharp(`${dir}/${name}${ext_in}`, {limitInputPixels: false});

        if (query.rotate !== undefined && query.rotate !== "false") {
            img = img.rotate(parseInt(query.rotate));
        }

        if (query.flip !== undefined && query.flip !== "false") {
            img = img.flip();
        }

        if (query.flop !== undefined && query.flop !== "false") {
            img = img.flop();
        }

        if (query.crop_left || query.crop_top || query.crop_width || query.crop_height) {
            if (!(query.crop_left && query.crop_top && query.crop_width && query.crop_height)) {
                res.sendStatus(400);
                return;
            }
            img = img.extract({
                left: parseInt(query.crop_left),
                top: parseInt(query.crop_top),
                width: parseInt(query.crop_width),
                height: parseInt(query.crop_height)
            })
        }

        if (query.width || query.height) {
            let resize = {};
            if (query.width) {
                resize.width = parseInt(req.query.width);
            }
            if (query.height) {
                resize.height = parseInt(req.query.height);
            }
            img = img.resize(resize);
        }

        res.type(mime.lookup(ext_out));
        try {
            res.send(await img.toFormat(ext_out.substring(1)).toBuffer());
        } catch (err) {
            console.log(err);
            res.sendStatus(415);
            return;
        }
    } catch (err) {
        console.log(err);
        res.sendStatus(501);
        return;
    }
}

async function getFeed(req, res, next) {
    if (!req.query.width || !req.query.height) {
        res.status(501).send("501: Please define a resolution");
        return;
    }
    res.type(mime.lookup("xml"));
    let dir = path.parse(req.path).dir;
    let data;
    try {
        data = await crawlCache(
            `images${dir}/`,
            true,
            true,
            -1,
            parseInt(req.query.width),
            parseInt(req.query.height),
            true
        );
    } catch (err) {
        console.log(err);
        res.sendStatus(501);
        return;
    }
    const feed = new Feed({
        title: "Wallpaper Garden",
        //link: req.originalUrl
    });
    for (let entry in data) {
        // http://localhost:3000/images/NoahBradley/Reference-Pictures_Crabtree-Falls/Reference-Pictures_Crabtree-Falls-9518?width=6000&height=1440&crop_left=0&crop_top=2522&crop_width=6720&crop_height=1613
        const crops = data[entry].crops;
        for (let i = 0; i < crops.length; i++) {
            let link = `${req.query.host ? req.query.host : ""}/${entry}.jpg?width=${req.query.width}&height=${req.query.height}&crop_left=${crops[i].left}&crop_top=${crops[i].top}&crop_width=${crops[i].width}&crop_height=${crops[i].height}&name=${path.parse(entry).name}.jpg`;
            feed.addItem({
                //title: `${entry}-${i}`,
                link//,
                //guid: link
            })
        }
    }
    res.send(feed.rss2());
}

async function getRandom(req, res, next) {
    const resize = req.query.width && req.query.height;
    if (!req.query.width || !req.query.height) {
        res.status(501).send("501: Please define a resolution");
        return;
    }
    let {dir, ext} = path.parse(req.path);
    let data;
    try {
        data = await crawlCache(
            `images${dir}/`,
            true,
            true,
            -1,
            resize ? parseInt(req.query.width) : 0,
            resize ? parseInt(req.query.height) : 0,
            true
        );
    } catch (err) {
        console.log(err);
        res.sendStatus(501);
        return;
    }
    let entry = Object.keys(data)[Math.floor(Math.random() * Object.keys(data).length)];
    const crop = data[entry].crops[Math.floor(Math.random() * data[entry].crops.length)];
    console.log(entry.substring(8), "XXX");
    let gi_req = {
        path: `${entry.substring(8)}${ext}`
    }
    if (resize) {
        gi_req[query] = {
            width: req.query.width,
            height: req.query.height,
            crop_left: crop.left,
            crop_top: crop.top,
            crop_width: crop.width,
            crop_height: crop.height
        }
    }
    await getImage(gi_req, res, next)
}

router.get(/^.+$/, async function (req, res, next) {
    let stat;
    const reqpath = decodeURI(req.path);
    if (reqpath.endsWith("/feed.xml")) {
        await getFeed(req, res, next);
    } else if (reqpath.match(/\/random(\.\w+)?$/)) {
        await getRandom(req, res, next);
    } else {
        try {
            stat = await fs.lstat(`images${reqpath}`);
        } catch (err) {
            await getImage(req, res, next);
            return;
        }
        if (stat.isDirectory()) {
            await getDir(req, res, next);
        } else {
            await getImage(req, res, next);
        }
    }
});

// https://stackoverflow.com/a/65927538/1526048
function reduce(numerator, denominator) {
    let a = numerator;
    let b = denominator;
    let c;
    while (b) {
        c = a % b;
        a = b;
        b = c;
    }
    return [numerator / a, denominator / a];
}

router.post(/^.+$/, async function (req, res, next) {
    if(req.hostname !== "localhost"){
        res.sendStatus(403);
        return;
    }
    let stat;
    const reqpath = decodeURI(req.path);
    const query = req.query;
    if (!query.width || !query.height || !query.crop_left || !query.crop_top || !query.crop_width || !query.crop_height) {
        console.log("Missing parameters");
        res.sendStatus(400);
        return;
    }
    try {
        stat = await fs.lstat(`images${reqpath}`);
        if (stat.isDirectory()) {
            console.log("That's a directory");
            res.sendStatus(501);
            return;
        }
    } catch (err) {
    }
    try {
        await findImage(reqpath);
    } catch (err) {

    }
    let {dir, name} = path.parse(reqpath);
    let [r_width, r_height] = reduce(query.width, query.height);
    let dat_path = `images${dir}/${name}.${r_width}x${r_height}.csv`;
    let data = `${query.crop_left}, ${query.crop_top}, ${query.crop_width}, ${query.crop_height}\n`
    try {
        await fs.readFile(dat_path);
        await fs.appendFile(
            dat_path, data
        );
    } catch (error) {
        await fs.writeFile(dat_path, data);
    }
    res.sendStatus(200);
});

module.exports = router;
