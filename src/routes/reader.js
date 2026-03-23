const express = require("express");
const { postReaderTts } = require("../controllers/readerController");

const router = express.Router();

router.post("/tts", postReaderTts);

module.exports = router;
