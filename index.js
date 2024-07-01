const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const instagramGetUrl = require("instagram-url-direct");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const port = 3003;

app.use(bodyParser.urlencoded({ extended: false }));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/privacyPolicy", (req, res) => {
    res.render("privacyPolicy");
});
app.get("/Contact", (req, res) => {
    res.render("Contact");
});
app.get("/Condition", (req, res) => {
    res.render("Condition");
});

app.use('/img', express.static('logo'))

app.post("/download", async (req, res) => {
    const url = req.body.url;
    const fileType = req.body.fileType;

    if (!url || !url.startsWith("https://www.instagram.com/")) {
        return res.render("index", { error: "Invalid URL" });
    }

    try {
        const response = await instaAPI(url);
        const fileUrl = response.url_list[0];

        if (fileType === 'mp4') {
            await downloadFile(res, fileUrl, 'mp4');
        } else if (fileType === 'mp3') {
            await downloadAudio(res, fileUrl);
        } else if (fileType === 'jpg') {
            await downloadImageNew(res, fileUrl);
        } else {
            return res.render("index", { error: "Unsupported file type" });
        }
    } catch (error) {
        console.error(error);
        res.render("index", { error: "Failed to download the file. Please try again later." });
    }
});

async function instaAPI(url) {
    try {
        const result = await instagramGetUrl(url);
        return result;
    } catch (error) {
        throw new Error("Failed to fetch download URLs");
    }
}

async function downloadFile(res, url, ext) {
    try {
        const fileResponse = await axios.get(url, { responseType: 'arraybuffer' });
        const contentType = fileResponse.headers['content-type'];

        const fileName = Date.now() + "." + ext;
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.send(fileResponse.data);
    } catch (error) {
        console.error(`Error downloading file: ${error.message}`);
        res.status(400).send("Error downloading file");
    }
}

async function downloadAudio(res, url) {
    try {
        const videoResponse = await axios.get(url, { responseType: 'stream' });
        const tempVideoPath = path.join(__dirname, "temp.mp4");
        const tempAudioPath = path.join(__dirname, "temp.mp3");

        const videoStream = fs.createWriteStream(tempVideoPath);
        videoResponse.data.pipe(videoStream);

        videoStream.on('finish', () => {
            ffmpeg(tempVideoPath)
                .noVideo()
                .audioCodec('libmp3lame')
                .save(tempAudioPath)
                .on('end', () => {
                    res.setHeader("Content-Type", "audio/mpeg");
                    res.setHeader("Content-Disposition", `attachment; filename="audio.mp3"`);
                    res.sendFile(tempAudioPath, () => {
                        fs.unlinkSync(tempVideoPath);
                        fs.unlinkSync(tempAudioPath);
                    });
                })
                .on('error', (err) => {
                    console.error(`ffmpeg error: ${err.message}`);
                    res.status(400).send("Error extracting audio");
                });
        });
    } catch (error) {
        console.error(`downloadAudio error: ${error.message}`);
        res.status(400).send("Error downloading file");
    }
}

async function downloadImageNew(res, url) {
    try {
        console.log(`Downloading file from: ${url}`); // Log the URL for debugging
        const fileResponse = await axios.get(url, { responseType: 'arraybuffer' });

        // Determine file extension based on content type or other means
        const contentType = fileResponse.headers['content-type'];
        let ext = '';
        if (contentType.startsWith('image/')) {
            ext = 'jpg';
        } else {
            throw new Error('Unsupported file format');
        }

        // Set headers and send file
        const fileName = Date.now() + "." + ext;
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.send(fileResponse.data);
    } catch (error) {
        console.error(`Error downloading file: ${error.message}`); // Log the error for debugging
        res.status(400).send("Error downloading file");
    }
}

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});
