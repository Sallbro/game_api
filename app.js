const express = require('express');
const app = express();
const cheerio = require('cheerio');
const axios = require('axios');
const dotenv = require('dotenv');
const { json } = require('stream/consumers');
dotenv.config();
const port = process.env['PORT'] || 9330;
// const ref = require('ref');
// get pages 
app.get('/', (req, res) => {
    try {
        res.status(200).send("working fine !...");
    }
    catch (err) {
        res.status(500).send("something went wrong !...");
    }
});

// page no 
app.get('/page/:page_no', async (req, res) => {
    const page_no = req.params.page_no;
    let act_url = process.env['GET_PAGE_URL'];
    act_url = act_url.replace("${page_no}", page_no);
    axios.get(act_url).then((response) => {
        const html = response.data;
        const $ = cheerio.load(html);
        const pages = [];
        let id = "";
        let optional_id = "";

        $("#search_resultsRows > a").map(function (i, e) {
            const page_instance = {};
            // if [appid] not present than find [data-ds-bundleid]
            id = $(e).attr("data-ds-appid");
            page_instance.id = id;
            $(e).find("div.responsive_search_name_combined").map(function (i, e) {
                page_instance.name = $(e).find("div.col.search_name.ellipsis > span.title").text();
                page_instance.release_date = $(e).find("div.col.search_released.responsive_secondrow").text();

                // if discount price is present 
                if ($(e).has("div.col.search_price_discount_combined.responsive_secondrow > div.col.search_price.responsive_secondrow > span > strike").attr() != undefined) {
                    page_instance.price = $(e).find("div.col.search_price_discount_combined.responsive_secondrow > div.col.search_price.responsive_secondrow > br")[0].nextSibling.nodeValue;
                }
                else {
                    page_instance.price = $(e).find("div.col.search_price_discount_combined.responsive_secondrow > div.col.search_price.responsive_secondrow").text().trim();
                }
            })

            optional_id = $(e).find("div.col.search_capsule > img").attr("src");
            optional_id = optional_id.slice(optional_id.indexOf("?t=") + 3);
            page_instance.img = `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg?t=${optional_id}`;
            pages.push(page_instance);
        });
        res.send(pages);
        res.end();

    }).catch((err) => {
        console.error(err);
        res.end();
    });


});

//search for games
app.get('/search', async (req, res) => {
    const sugg = req.query.sugg;
    let act_url = process.env['GET_SEARCH_URL'];
    act_url = act_url.replace("${sugg}", sugg);
    axios.get(act_url).then((response) => {
        const data = response.data;
        let img_url = "";
        for (x of data) {
            img_url = x.img;
            img_url = img_url.replace("capsule_sm_120", "header");
            x.img = img_url;
        }
        res.send(data);
        res.end();

    }).catch(e => {
        console.log(e);
        res.end();
    });
});

//single game details
app.get('/single_game/:id', async (req, res) => {

    const game_id = req.params.id;
    // actual url 
    let act_url = process.env['GET_SINGLE_GAME_URL'];
    act_url = act_url.replace("${game_id}", game_id);

    let set_header = {
        headers: {
            'Cookie': 'birthtime=1007145001'
        }
    };

    axios.get(act_url, set_header).then((response) => {
        const html = response.data;
        const $ = cheerio.load(html);
        const result = {};
        // get Game name 
        const name = $("#appHubAppName").text();
        result.name = name;

        // get Game describtion 
        let desc = $("#game_highlights > div.rightcol > div > div.game_description_snippet").text();
        desc = desc.replace(/\t/g, '');
        desc = desc.replace(/\n/g, '');
        result.desc = desc;

        // get Game release date 
        const release_date = $("#game_highlights > div.rightcol > div > div.glance_ctn_responsive_left > div.release_date > div.date").text();
        result.release_date = release_date;

        // get external links
        const external_links = [];
        let website = $("#appDetailsUnderlinedLinks > div > div > div:nth-child(2) > a:nth-child(1)").attr("href");
        external_links.push({
            "name": "website",
            "link": decodeURIComponent(website).replace("https://steamcommunity.com/linkfilter/?u=", "")
        });
        for (let i = 2; i <= 5; i++) {
            let name = $(`#appDetailsUnderlinedLinks > div > div > div:nth-child(2) > a:nth-child(${i}) > span`).text();
            switch (name) {
                case "YouTube":
                    console.log(name);
                    external_links.push({
                        "name": "YouTube",
                        "link": decodeURIComponent($(`#appDetailsUnderlinedLinks > div > div > div:nth-child(2) > a:nth-child(${i})`).attr("href")).replace("https://steamcommunity.com/linkfilter/?u=", "")
                    });
                    break;
                case "X":
                    console.log(name);
                    external_links.push({
                        "name": "X",
                        "link": decodeURIComponent($(`#appDetailsUnderlinedLinks > div > div > div:nth-child(2) > a:nth-child(${i})`).attr("href")).replace("https://steamcommunity.com/linkfilter/?u=", "")
                    });
                    break;
                case "Instagram":
                    console.log(name);
                    external_links.push({
                        "name": "Instagram",
                        "link": decodeURIComponent($(`#appDetailsUnderlinedLinks > div > div > div:nth-child(2) > a:nth-child(${i})`).attr("href")).replace("https://steamcommunity.com/linkfilter/?u=", "")
                    });
                    break;
                case "Facebook":
                    console.log(name);
                    external_links.push({
                        "name": "Facebook",
                        "link": decodeURIComponent($(`#appDetailsUnderlinedLinks > div > div > div:nth-child(2) > a:nth-child(${i})`).attr("href")).replace("https://steamcommunity.com/linkfilter/?u=", "")
                    });
                    break;
            }
        }
        result.external_links = external_links;

        // get Game tags 
        const tags = [];
        result.tags = tags;
        $("#glanceCtnResponsiveRight > div.glance_tags_ctn.popular_tags_ctn > div.glance_tags.popular_tags > a").each(function () {
            tags.push($(this).text().trim());
        });

        // get language supported
        const lang = [];
        result.lang = lang;
        $("#languageTable > table > tbody > tr").map(function (i, el) {
            $(el).find('td:nth-of-type(1)').text().trim() !== "" ? lang.push($(el).find('td:nth-of-type(1)').text().trim()) : "";
        });

        //get dev details
        const developer_name = [];
        const publisher = [];
        const franchise = [];
        const dev_details = {
            developer_name,
            publisher,
            franchise
        }
        result.dev_details = dev_details;
        $("#genresAndManufacturer > div.dev_row").map(function (i, e) {
            // get developer_name
            if (i == 0) {
                $(e).find("a").map(function (i, e) {
                    developer_name.push($(e).text());
                })
            }
            // get publisher
            if (i == 1) {
                $(e).find("a").map(function (i, e) {
                    publisher.push($(e).text());
                })
            }
            // get franchise
            if (i == 2) {
                $(e).find("a").map(function (i, e) {
                    franchise.push($(e).text());
                })
            }

        });

        // get screenshot
        const screenshot = [];
        const videos = [];
        const images = {
            screenshot: screenshot,
            videos: videos
        }
        result.images = images;
        const sys_req = {}
        result.sys_req = sys_req;
        $("#highlight_player_area > div > div.screenshot_holder > a").each(function () {
            screenshot.push($(this).attr("href"));
        });

        // get videos
        let video_url = process.env['VIDEO_URL'];
        $("#highlight_strip_scroll > div > img").each(function () {
            if ($(this).attr("class") == "movie_thumb") {
                let str = $(this).attr("src");
                str = str.slice(str.indexOf("apps/") + 5, str.indexOf("/movie"));
                video_url = video_url.replace("${str}", str);
                videos.push(video_url);
            }
        });

        // get system_requirement
        $("div.sysreq_contents > div").each(function () {

            // get for Window 
            if ($(this).attr("data-os") == "win") {
                const min_window = [];
                const rec_window = [];
                const window = {
                    min: min_window,
                    recomm: rec_window
                }
                sys_req.window = window;
                //check types of sys_req [full] or [leftcol and rightcol]
                if ($("[data-os = 'win'] div").hasClass("game_area_sys_req_full") == true) {
                    $("[data-os = 'win'] div.game_area_sys_req_full > ul > ul > li").each(function () {
                        min_window.push($(this).text());
                        rec_window.push($(this).text());
                    })
                }
                else {
                    // get MINIMUM
                    $("[data-os = 'win'] div.game_area_sys_req_leftCol > ul > ul > li").each(function () {
                        min_window.push($(this).text());
                    })

                    // get RECOMMENDED
                    $("[data-os = 'win'] div.game_area_sys_req_rightCol > ul > ul > li").each(function () {
                        rec_window.push($(this).text());
                    })
                }
            }
            // get for Linux 
            if ($(this).attr("data-os") == "linux") {
                const min_linux = [];
                const rec_linux = [];
                const linux = {
                    min: min_linux,
                    recomm: rec_linux
                }
                sys_req.linux = linux;
                //check types of sys_req [full] or [leftcol and rightcol]
                if ($("[data-os = 'linux'] div").hasClass("game_area_sys_req_full") == true) {
                    $("[data-os = 'linux'] div.game_area_sys_req_full > ul > ul > li").each(function () {
                        min_linux.push($(this).text());
                        rec_linux.push($(this).text());
                    })
                }
                else {
                    // get MINIMUM
                    $("[data-os = 'linux'] div.game_area_sys_req_leftCol > ul > ul > li").each(function () {
                        min_linux.push($(this).text());
                    })

                    // get RECOMMENDED
                    $("[data-os = 'linux'] div.game_area_sys_req_rightCol > ul > ul > li").each(function () {
                        rec_linux.push($(this).text());
                    })
                }
            }
            // get for Macos 
            if ($(this).attr("data-os") == "mac") {
                const min_macos = [];
                const rec_macos = [];
                const mac_os = {
                    min: min_macos,
                    recomm: rec_macos
                }
                sys_req.mac_os = mac_os;
                //check types of sys_req [full] or [leftcol and rightcol]
                if ($("[data-os = 'mac'] div").hasClass("game_area_sys_req_full") == true) {
                    $("[data-os = 'mac'] div.game_area_sys_req_full > ul > ul > li").each(function () {
                        min_macos.push($(this).text());
                        rec_macos.push($(this).text());
                    })
                }
                else {
                    // get MINIMUM
                    $("[data-os = 'mac'] div.game_area_sys_req_leftCol > ul > ul > li").each(function () {
                        min_macos.push($(this).text());
                    })

                    // get RECOMMENDED
                    $("[data-os = 'mac'] div.game_area_sys_req_rightCol > ul > ul > li").each(function () {
                        rec_macos.push($(this).text());
                    })
                }
            }
        });

        // about Game 
        let about_game = $("#game_area_description").text();
        about_game = about_game.replace(/\t/g, '');
        about_game = about_game.replace(/\n/g, '');
        result.about_game = about_game;

        res.status(200).send(result);
        res.end();

    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

//about game
app.get('/about_game/:id', async (req, res) => {

    const game_id = req.params.id;
    // actual url 
    let act_url = process.env['GET_SINGLE_GAME_URL'];
    act_url = act_url.replace("${game_id}", game_id);

    let set_header = {
        headers: {
            'Cookie': 'birthtime=1007145001'
        }
    };

    axios.get(act_url, set_header).then((response) => {
        const html = response.data;
        const $ = cheerio.load(html);
        const result = {};

        // about Game 
        let about_game = $("#game_area_description").text();
        about_game = about_game.replace(/\t/g, '');
        about_game = about_game.replace(/\n/g, '');
        result.about_game = about_game;

        res.status(200).send(result);
        res.end();

    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

//requirement 
app.get('/requirements/:id', async (req, res) => {

    const game_id = req.params.id;
    // actual url 
    let act_url = process.env['GET_SINGLE_GAME_URL'];
    act_url = act_url.replace("${game_id}", game_id);

    let set_header = {
        headers: {
            'Cookie': 'birthtime=1007145001'
        }
    };

    axios.get(act_url, set_header).then((response) => {
        const html = response.data;
        const $ = cheerio.load(html);
        const result = {};

        // get system_requirement
        const sys_req = {}
        result.sys_req = sys_req;
        $("div.sysreq_contents > div").each(function () {

            // get for Window 
            if ($(this).attr("data-os") == "win") {
                const min_window = [];
                const rec_window = [];
                const window = {
                    min: min_window,
                    recomm: rec_window
                }
                sys_req.window = window;
                //check types of sys_req [full] or [leftcol and rightcol]
                if ($("[data-os = 'win'] div").hasClass("game_area_sys_req_full") == true) {
                    $("[data-os = 'win'] div.game_area_sys_req_full > ul > ul > li").each(function () {
                        min_window.push($(this).text());
                        rec_window.push($(this).text());
                    })
                }
                else {
                    // get MINIMUM
                    $("[data-os = 'win'] div.game_area_sys_req_leftCol > ul > ul > li").each(function () {
                        min_window.push($(this).text());
                    })

                    // get RECOMMENDED
                    $("[data-os = 'win'] div.game_area_sys_req_rightCol > ul > ul > li").each(function () {
                        rec_window.push($(this).text());
                    })
                }
            }
            // get for Linux 
            if ($(this).attr("data-os") == "linux") {
                const min_linux = [];
                const rec_linux = [];
                const linux = {
                    min: min_linux,
                    recomm: rec_linux
                }
                sys_req.linux = linux;
                //check types of sys_req [full] or [leftcol and rightcol]
                if ($("[data-os = 'linux'] div").hasClass("game_area_sys_req_full") == true) {
                    $("[data-os = 'linux'] div.game_area_sys_req_full > ul > ul > li").each(function () {
                        min_linux.push($(this).text());
                        rec_linux.push($(this).text());
                    })
                }
                else {
                    // get MINIMUM
                    $("[data-os = 'linux'] div.game_area_sys_req_leftCol > ul > ul > li").each(function () {
                        min_linux.push($(this).text());
                    })

                    // get RECOMMENDED
                    $("[data-os = 'linux'] div.game_area_sys_req_rightCol > ul > ul > li").each(function () {
                        rec_linux.push($(this).text());
                    })
                }
            }
            // get for Macos 
            if ($(this).attr("data-os") == "mac") {
                const min_macos = [];
                const rec_macos = [];
                const mac_os = {
                    min: min_macos,
                    recomm: rec_macos
                }
                sys_req.mac_os = mac_os;
                //check types of sys_req [full] or [leftcol and rightcol]
                if ($("[data-os = 'mac'] div").hasClass("game_area_sys_req_full") == true) {
                    $("[data-os = 'mac'] div.game_area_sys_req_full > ul > ul > li").each(function () {
                        min_macos.push($(this).text());
                        rec_macos.push($(this).text());
                    })
                }
                else {
                    // get MINIMUM
                    $("[data-os = 'mac'] div.game_area_sys_req_leftCol > ul > ul > li").each(function () {
                        min_macos.push($(this).text());
                    })

                    // get RECOMMENDED
                    $("[data-os = 'mac'] div.game_area_sys_req_rightCol > ul > ul > li").each(function () {
                        rec_macos.push($(this).text());
                    })
                }
            }
        });
        res.status(200).send(result);
        res.end();

    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

//developer details
app.get('/dev_details/:id', async (req, res) => {

    const game_id = req.params.id;
    // actual url 
    let act_url = process.env['GET_SINGLE_GAME_URL'];
    act_url = act_url.replace("${game_id}", game_id);

    let set_header = {
        headers: {
            'Cookie': 'birthtime=1007145001'
        }
    };

    axios.get(act_url, set_header).then((response) => {
        const html = response.data;
        const $ = cheerio.load(html);
        const result = {};

        //get dev details
        const developer_name = [];
        const publisher = [];
        const franchise = [];
        const dev_details = {
            developer_name,
            publisher,
            franchise
        }
        result.dev_details = dev_details;
        $("#genresAndManufacturer > div.dev_row").map(function (i, e) {
            // get developer_name
            if (i == 0) {
                $(e).find("a").map(function (i, e) {
                    developer_name.push($(e).text());
                })
            }
            // get publisher
            if (i == 1) {
                $(e).find("a").map(function (i, e) {
                    publisher.push($(e).text());
                })
            }
            // get franchise
            if (i == 2) {
                $(e).find("a").map(function (i, e) {
                    franchise.push($(e).text());
                })
            }

        });

        res.status(200).send(result);
        res.end();

    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

//developer name
app.get('/developer_name/:id', async (req, res) => {

    const game_id = req.params.id;
    // actual url 
    let act_url = process.env['GET_SINGLE_GAME_URL'];
    act_url = act_url.replace("${game_id}", game_id);

    let set_header = {
        headers: {
            'Cookie': 'birthtime=1007145001'
        }
    };

    axios.get(act_url, set_header).then((response) => {
        const html = response.data;
        const $ = cheerio.load(html);
        const result = {};

        //get dev details
        const developer_name = [];
        result.developer_name = developer_name;
        $("#genresAndManufacturer > div.dev_row").map(function (i, e) {
            // get developer_name
            if (i == 0) {
                $(e).find("a").map(function (i, e) {
                    developer_name.push($(e).text());
                })
            }

        });
        result.developer_name = developer_name;

        res.status(200).send(result);
        res.end();

    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

//publisher
app.get('/publisher/:id', async (req, res) => {

    const game_id = req.params.id;
    // actual url 
    let act_url = process.env['GET_SINGLE_GAME_URL'];
    act_url = act_url.replace("${game_id}", game_id);

    let set_header = {
        headers: {
            'Cookie': 'birthtime=1007145001'
        }
    };

    axios.get(act_url, set_header).then((response) => {
        const html = response.data;
        const $ = cheerio.load(html);
        const result = {};

        //get dev details
        const publisher = [];
        result.publisher = publisher;
        $("#genresAndManufacturer > div.dev_row").map(function (i, e) {
            // get publisher
            if (i == 1) {
                $(e).find("a").map(function (i, e) {
                    publisher.push($(e).text());
                })
            }

        });

        res.status(200).send(result);
        res.end();

    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

//franchise
app.get('/franchise/:id', async (req, res) => {

    const game_id = req.params.id;
    // actual url 
    let act_url = process.env['GET_SINGLE_GAME_URL'];
    act_url = act_url.replace("${game_id}", game_id);

    let set_header = {
        headers: {
            'Cookie': 'birthtime=1007145001'
        }
    };

    axios.get(act_url, set_header).then((response) => {
        const html = response.data;
        const $ = cheerio.load(html);
        const result = {};

        //get franchise
        const franchise = [];
        result.franchise = franchise;
        $("#genresAndManufacturer > div.dev_row").map(function (i, e) {
            // get franchise
            if (i == 2) {
                $(e).find("a").map(function (i, e) {
                    franchise.push($(e).text());
                })
            }

        });

        res.status(200).send(result);
        res.end();

    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

//developer name
app.get('/developer_name/:id', async (req, res) => {

    const game_id = req.params.id;
    // actual url 
    let act_url = process.env['GET_SINGLE_GAME_URL'];
    act_url = act_url.replace("${game_id}", game_id);

    let set_header = {
        headers: {
            'Cookie': 'birthtime=1007145001'
        }
    };

    axios.get(act_url, set_header).then((response) => {
        const html = response.data;
        const $ = cheerio.load(html);
        const result = {};

        //get dev details
        const developer_name = [];
        result.developer_name = developer_name;
        $("#genresAndManufacturer > div.dev_row").map(function (i, e) {
            // get developer_name
            if (i == 0) {
                $(e).find("a").map(function (i, e) {
                    developer_name.push($(e).text());
                })
            }

        });

        res.status(200).send(result);
        res.end();

    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

//languages supported
app.get('/languages_supported/:id', async (req, res) => {

    const game_id = req.params.id;
    // actual url 
    let act_url = process.env['GET_SINGLE_GAME_URL'];
    act_url = act_url.replace("${game_id}", game_id);

    let set_header = {
        headers: {
            'Cookie': 'birthtime=1007145001'
        }
    };

    axios.get(act_url, set_header).then((response) => {
        const html = response.data;
        const $ = cheerio.load(html);
        const result = {};

        // get language supported
        const lang = [];
        result.lang = lang;
        $("#languageTable > table > tbody > tr").map(function (i, el) {
            $(el).find('td:nth-of-type(1)').text().trim() !== "" ? lang.push($(el).find('td:nth-of-type(1)').text().trim()) : "";
        });

        res.status(200).send(result);
        res.end();

    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

//tags
app.get('/tags/:id', async (req, res) => {

    const game_id = req.params.id;
    // actual url 
    let act_url = process.env['GET_SINGLE_GAME_URL'];
    act_url = act_url.replace("${game_id}", game_id);

    let set_header = {
        headers: {
            'Cookie': 'birthtime=1007145001'
        }
    };

    axios.get(act_url, set_header).then((response) => {
        const html = response.data;
        const $ = cheerio.load(html);
        const result = {};

        // get Game tags 
        const tags = [];
        result.tags = tags;
        $("#glanceCtnResponsiveRight > div.glance_tags_ctn.popular_tags_ctn > div.glance_tags.popular_tags > a").each(function () {
            tags.push($(this).text().trim());
        });

        res.status(200).send(result);
        res.end();

    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

//external links
app.get('/external_links/:id', async (req, res) => {

    const game_id = req.params.id;
    // actual url 
    let act_url = process.env['GET_SINGLE_GAME_URL'];
    act_url = act_url.replace("${game_id}", game_id);

    let set_header = {
        headers: {
            'Cookie': 'birthtime=1007145001'
        }
    };

    axios.get(act_url, set_header).then((response) => {
        const html = response.data;
        const $ = cheerio.load(html);
        const result = {};

        // get website
        const external_links = [];
        let website = $("#appDetailsUnderlinedLinks > div > div > div:nth-child(2) > a:nth-child(1)").attr("href");
        external_links.push({
            "name": "website",
            "link": decodeURIComponent(website).replace("https://steamcommunity.com/linkfilter/?u=", "")
        });
        for (let i = 2; i <= 5; i++) {
            let name = $(`#appDetailsUnderlinedLinks > div > div > div:nth-child(2) > a:nth-child(${i}) > span`).text();
            switch (name) {
                case "YouTube":
                    external_links.push({
                        "name": "YouTube",
                        "link": decodeURIComponent($(`#appDetailsUnderlinedLinks > div > div > div:nth-child(2) > a:nth-child(${i})`).attr("href")).replace("https://steamcommunity.com/linkfilter/?u=", "")
                    });
                    break;
                case "X":
                    external_links.push({
                        "name": "X",
                        "link": decodeURIComponent($(`#appDetailsUnderlinedLinks > div > div > div:nth-child(2) > a:nth-child(${i})`).attr("href")).replace("https://steamcommunity.com/linkfilter/?u=", "")
                    });
                    break;
                case "Instagram":
                    external_links.push({
                        "name": "Instagram",
                        "link": decodeURIComponent($(`#appDetailsUnderlinedLinks > div > div > div:nth-child(2) > a:nth-child(${i})`).attr("href")).replace("https://steamcommunity.com/linkfilter/?u=", "")
                    });
                    break;
                case "Facebook":
                    external_links.push({
                        "name": "Facebook",
                        "link": decodeURIComponent($(`#appDetailsUnderlinedLinks > div > div > div:nth-child(2) > a:nth-child(${i})`).attr("href")).replace("https://steamcommunity.com/linkfilter/?u=", "")
                    });
                    break;
            }
        }
        result.external_links = external_links;

        res.status(200).send(result);
        res.end();

    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

//reviews games
app.get('/reviews/:category/:id', (req, res) => {

    const id = req.params.id;
    const category = req.params.category;
    const limit = req.query.limit;
    const offset = Math.ceil(Number(req.query.offset) / 10) > 0 ? Math.ceil(Number(req.query.offset) / 10) : 0;


    // actual url 
    let review_url = process.env['REVIEWS_URL'];
    review_url = review_url.replace("${env_game_id}", id);
    review_url = review_url.replace("${env_reviewcategory}", category);

    //direct review url
    let direct_review_url = process.env['DIRECT_REVIEWS_URL'];

    //array userreviewcursor
    const array_userreviewcursor = JSON.parse(process.env['ARRAY_USERREVIEWSCURSOR']);

    //endpoints
    let endpoints = [review_url];

    //check the limit 
    if (limit > 10 && limit < 100) {
        for (var i = 1 + offset; i <= Math.ceil((Number(limit) / 10)) + offset; i++) {
            let env_dir_rev_url = direct_review_url;
            env_dir_rev_url = env_dir_rev_url.replace(/\${env_reviewpageno}/g, i).replace(/\${env_reviewcategory}/g, category).replace("${env_userreviewsoffset}", (i - 1) * 10).replace("${env_game_id}", id).replace("${env_userreviewcursor}", array_userreviewcursor[i - 2]);

            endpoints.push(env_dir_rev_url);
        }
    }
    else {
        for (var i = 2; i <= 10; i++) {
            let env_dir_rev_url = direct_review_url;
            env_dir_rev_url = env_dir_rev_url.replace(/\${env_reviewpageno}/g, i).replace(/\${env_reviewcategory}/g, category).replace("${env_userreviewsoffset}", (i - 1) * 10).replace("${env_game_id}", id).replace("${env_userreviewcursor}", array_userreviewcursor[i - 2]);

            endpoints.push(env_dir_rev_url);
        }
    }

    //start requesting
    axios.all(endpoints.map(async (endpoint) => {
        let get_reviews = [];
        await axios.get(endpoint).then((response) => {
            const html = response.data;
            const $ = cheerio.load(html);
            let all_reviews = [];
            $("div.apphub_Card").each(function () {
                let obj_review = {};
                $(this).after("div.apphub_CardContentMain").map(function (i, el) {
                    let title = $(el).find(".title").text();
                    let clone_content = $(el).find("div.apphub_UserReviewCardContent > div.apphub_CardTextContent").clone();
                    clone_content.children().remove();
                    let content = clone_content.text().trim();
                    let date = $(el).find("div.apphub_UserReviewCardContent > div.apphub_CardTextContent > div.date_posted").text().trim();
                    obj_review.title = title;
                    obj_review.date = date;
                    obj_review.content = content;
                });
                $(this).after("div.apphub_CardContentAuthorBlock").map(function (i, el) {
                    let user_profile = $(el).find("div.apphub_friend_block_container > div > a > div.appHubIconHolder > img").attr("src");
                    if (user_profile != undefined) {
                        user_profile = user_profile.replace(".jpg", "_full.jpg");
                    }
                    let user_name = $(el).find("div.apphub_friend_block_container > div > div.apphub_CardContentAuthorName > a:nth-child(2)").text();
                    obj_review.user_profile = user_profile;
                    obj_review.user_name = user_name;
                });
                get_reviews.push(obj_review);
            });
        });
        return get_reviews;
    }
    )).then((data) => {
        const final_data = [];
        for (x of data) {
            final_data.push(...x);
        }
        res.send(final_data);
        res.end();
    }).catch((err) => {
        console.error(err);
        res.end();
    });



});

// game news 
app.get('/news/:category/:id', async (req, res) => {

    const id = req.params.id;
    const category = req.params.category;
    const limit = req.query.limit;
    const offset = Math.ceil(Number(req.query.offset) / 10) > 0 ? Math.ceil(Number(req.query.offset) / 10) : 0;


    // actual url 
    let news_url = process.env['NEWS_URL'];
    news_url = news_url.replace("${env_game_id}", id);
    news_url = news_url.replace("${env_newscategory}", category);

    //direct review url
    let direct_news_url = process.env['DIRECT_NEWS_URL'];

    //endpoints
    let endpoints = [news_url];

    //check the limit 
    if (limit > 10 && limit < 100) {
        for (var i = 1+offset; i <= Math.ceil((Number(limit) / 10))+offset; i++) {
            let env_dir_rev_url = direct_news_url;
            env_dir_rev_url = env_dir_rev_url.replace(/\${env_newspageno}/g, i).replace(/\${env_newscategory}/g, category).replace("${env_announcementsoffset}", (i - 1) * 10).replace("${env_game_id}", id);

            endpoints.push(env_dir_rev_url);
        }
    }
    else {
        for (var i = 1; i <= 10; i++) {
            let env_dir_rev_url = direct_news_url;
            env_dir_rev_url = env_dir_rev_url.replace(/\${env_newspageno}/g, i).replace(/\${env_newscategory}/g, category).replace("${env_announcementsoffset}", (i - 1) * 10).replace("${env_game_id}", id);

            endpoints.push(env_dir_rev_url);
        }
    }

    //start requesting
    axios.all(endpoints.map(async (endpoint) => {
        let get_reviews = [];
        await axios.get(endpoint).then((response) => {
            const html = response.data;
            const $ = cheerio.load(html);
            let all_reviews = [];
            $("div.apphub_Card").each(function () {
                let obj_review = {};
                $(this).after("div.apphub_CardContentMain").map(function (i, el) {
                    let news_title = $(el).find(".apphub_CardContentNewsTitle").text();
                    let date = $(el).find("div.apphub_CardContentNewsDate").text().trim();
                    obj_review.news_title = news_title;
                    obj_review.date = date;
                });
                $(this).after("div.apphub_CardContentNewsDesc").map(function (i, el) {
                    let content = "";
                    $(el).find("ul.bb_ul li").map(function (i, el) {
                        content += $(el).text();
                    });
                    if (content == "") {
                        const clone_content = $(el).find("div.apphub_CardTextContent").clone();
                        clone_content.children().remove();
                        content = $(clone_content).text();
                    }
                    obj_review.content = content;
                });
                $(this).after("div.apphub_CardContentAuthorBlock").map(function (i, el) {
                    let like = $(el).find("div.apphub_CardRating.news.rateUp").text();
                    obj_review.like = like;
                });

                get_reviews.push(obj_review);
            });
        });
        return get_reviews;
    }
    )).then((data) => {
        const final_data = [];
        for (x of data) {
            final_data.push(...x);
        }
        res.send(final_data);
        res.end();
    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

// game screenshots 
app.get('/screenshots/:id', async (req, res) => {

    const id = req.params.id;
    const limit = req.query.limit;
    const offset = Math.ceil(Number(req.query.offset) / 10) > 0 ? Math.ceil(Number(req.query.offset) / 10) : 0;

    // actual url 
    let screenshot_url = process.env['SCREENSHOTS_URL'];
    screenshot_url = screenshot_url.replace("${env_game_id}", id);

    //direct review url
    let direct_screenshot_url = process.env['DIRECT_SCREENSHOTS_URL'];

    //endpoints
    let endpoints = [];

    //check the limit 
    if (limit > 10 && limit < 100) {
        for (var i = 1 + offset; i <= Math.ceil((Number(limit) / 10)) + offset; i++) {
            let env_dir_rev_url = direct_screenshot_url;
            env_dir_rev_url = env_dir_rev_url.replace(/\${env_screenshotspageno}/g, i).replace("${env_game_id}", id);
            endpoints.push(env_dir_rev_url);
        }
    }
    else {
        let env_dir_rev_url = direct_screenshot_url;
        env_dir_rev_url = env_dir_rev_url.replace(/\${env_screenshotspageno}/g, 1).replace("${env_game_id}", id);

        endpoints.push(env_dir_rev_url);
    }

    //start requesting
    axios.all(endpoints.map(async (endpoint) => {
        let get_reviews = [];
        await axios.get(endpoint).then((response) => {
            const html = response.data;
            const $ = cheerio.load(html);
            $("div.apphub_Card > div.apphub_CardContentClickable > div.apphub_CardContentPreviewImageBorder > div.apphub_CardContentMain").map(function (i, el) {
                let img = $(el).find("img.apphub_CardContentPreviewImage").attr("src");
                get_reviews.push(img);
            });
        })
        return get_reviews;
    })).then((data) => {
        const final_data = [];
        for (x of data) {
            final_data.push(...x);
        }
        res.send(final_data);
        res.end();
    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

// game videos
app.get('/videos/:id', async (req, res) => {

    const id = req.params.id;
    const limit = req.query.limit;
    const offset = Math.ceil(Number(req.query.offset) / 10) > 0 ? Math.ceil(Number(req.query.offset) / 10) : 0;

    // actual url 
    let screenshot_url = process.env['VIDEOS_URL'];
    screenshot_url = screenshot_url.replace("${env_game_id}", id);

    //direct review url
    let direct_screenshot_url = process.env['DIRECT_VIDEOS_URL'];

    //endpoints
    let endpoints = [screenshot_url];

    //check the limit 
    if (limit > 10 && limit < 100) {
        for (var i = 1 + offset; i <= Math.ceil((Number(limit) / 10)) + offset; i++) {
            let env_dir_rev_url = direct_screenshot_url;
            env_dir_rev_url = env_dir_rev_url.replace(/\${env_videospageno}/g, i).replace("${env_game_id}", id);

            endpoints.push(env_dir_rev_url);
        }
    }
    else {
        let env_dir_rev_url = direct_screenshot_url;
        env_dir_rev_url = env_dir_rev_url.replace(/\${env_videospageno}/g, i).replace("${env_game_id}", id);

        endpoints.push(env_dir_rev_url);
    }

    //start requesting
    axios.all(endpoints.map(async (endpoint) => {
        let get_videos = [];

        await axios.get(endpoint).then((response) => {
            const html = response.data;
            const $ = cheerio.load(html);
            const regex_video = /\/vi\/([^\/]+)\//;

            $("div.apphub_Card > div.apphub_CardContentClickable > div.apphub_CardContentPreviewImageBorder > div.apphub_CardContentMain").map(function (i, el) {
                let img = $(el).find("img.apphub_CardContentPreviewImage").attr("src");
                get_videos.push("https://www.youtube.com/watch?v=" + img.match(regex_video)[1]);
            });
        })
        return get_videos;
    })).then((data) => {
        const final_data = [];
        for (x of data) {
            final_data.push(...x);
        }
        res.send(final_data);
        res.end();
    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

// artwork
app.get('/artwork/:id', async (req, res) => {

    const id = req.params.id;
    const limit = req.query.limit;
    const offset = Math.ceil(Number(req.query.offset) / 10) > 0 ? Math.ceil(Number(req.query.offset) / 10) : 0;


    // actual url 
    let artwork_url = process.env['ARTWORK_URL'];
    artwork_url = artwork_url.replace(/\${env_game_id}/g, id);
    artwork_url = artwork_url.replace(/\${env_artworkpageno}/g, 1 + offset);
    artwork_url = artwork_url.replace(/\${env_artwork_limit}/g, limit || 10);

    //start requesting
    await axios.get(artwork_url).then((response) => {
        let get_broadcast = [];
        const html = response.data;
        const $ = cheerio.load(html);

        $("div.apphub_Card > div.apphub_CardContentClickable > div.apphub_CardContentPreviewImageBorder > div.apphub_CardContentMain").map(function (i, el) {
            let img = $(el).find("img").attr("src");
            get_broadcast.push(img);
        });
        res.send(get_broadcast);
        res.end();
    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

// broadcasts
app.get('/broadcasts/:id', async (req, res) => {

    const id = req.params.id;
    const limit = req.query.limit;
    const offset = Math.ceil(Number(req.query.offset) / 10) > 0 ? Math.ceil(Number(req.query.offset) / 10) : 0;


    // actual url 
    let broadcast_url = process.env['BROADCAST_URL'];
    broadcast_url = broadcast_url.replace("${env_game_id}", id);
    broadcast_url = broadcast_url.replace("${env_broadcastpageno}", 1 + offset);
    broadcast_url = broadcast_url.replace("${env_broadcast_limit}", limit || 10);

    //start requesting
    await axios.get(broadcast_url).then((response) => {
        let get_broadcast = [];
        const html = response.data;
        const $ = cheerio.load(html);

        $("div.Broadcast_Card").map(function (i, el) {
            let img = $(el).find("a").attr("href");
            get_broadcast.push(img);
        });
        res.send(get_broadcast);
        res.end();
    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

// guides
app.get('/guides/:id/:page_no', async (req, res) => {

    const id = req.params.id;
    const page_no = req.params.page_no;

    // actual url 
    let guides_url = process.env['GUIDE_URL'];
    guides_url = guides_url.replace("${env_game_id}", id);
    guides_url = guides_url.replace("${env_guide_pageno}", page_no || 1);

    //start requesting
    await axios.get(guides_url).then((response) => {
        let get_guides = [];
        const html = response.data;
        const $ = cheerio.load(html);

        $("div.workshopItemCollectionContainer").map(function (i, el) {
            const guide = {};
            const guide_id = $(el).find("a").attr("data-publishedfileid");
            guide.guide_id = guide_id;

            const guide_title = $(el).addClass("a > div.workshopItemDetails > div.workshopItemTitle").text().trim().replace(/\n/g, "").replace(/\t/g, "");
            guide.title = guide_title;

            const guide_shortdesc = $(el).addClass("a > div.workshopItemDetails > div.workshopItemShortDesc").text().trim().replace(/\n/g, "").replace(/\t/g, "");
            guide.short_desc = guide_shortdesc;

            get_guides.push(guide);
        });
        res.send(get_guides);
        res.end();
    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

// single guide by guide id
app.get('/guide/:guide_id', async (req, res) => {

    const guide_id = req.params.guide_id;

    // actual url 
    let guides_url = process.env['SINGLE_GUIDE_URL'];
    guides_url = guides_url.replace("${env_guide_id}", guide_id);

    //start requesting
    await axios.get(guides_url).then((response) => {
        let get_guide = {};
        const html = response.data;
        const $ = cheerio.load(html);
        const postdate = $("div.rightDetailsBlock > div.detailsStatsContainerRight > div.detailsStatRight").text();
        const author = $("div.guideTopContent > div.guideAuthors").text();
        const title = $("div.guideTopContent > div.workshopItemTitle").text();
        const short_desc = $("div.guideTopContent > div.guideTopDescription").text();
        const full_desc = $("div.guide > div.subSection > div.subSectionDesc > b").html().replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '');

        get_guide.guide_id = guide_id;
        get_guide.postdate = postdate;
        get_guide.author = author;
        get_guide.title = title;
        get_guide.short_desc = short_desc;
        get_guide.full_desc = full_desc;

        res.send(get_guide);
        res.end();
    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

// discussion 
app.get('/disc', async (req, res) => {

    // const guide_id = req.params.guide_id;

    // actual url 
    // let guides_url = process.env['SINGLE_GUIDE_URL'];
    // guides_url = guides_url.replace("${env_guide_id}", guide_id);
    let discussion_url = "https://steamcommunity.com/forum/3381077/General/render/0/?start=30&count=15";

    //start requesting
    await axios.get(discussion_url).then((response) => {
        let get_guide = {};
        const html = response.data.topics_html;
        const $ = cheerio.load(html);
        // const tempDiv = document.createElement('div');
        // tempDiv.innerHTML = html;
        // console.log($.html());
        res.send({ "data": $.html() });
        res.end();
    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

// get free to play games 
app.get('/free_to_play/:folio', async (req, res) => {
    console.log(req.params.folio);
    const page_no = req.params.page_no;
    let act_url = "https://store.steampowered.com/genre/Free%20to%20Play/?offset=12";
    // act_url = act_url.replace("${page_no}", page_no);
    axios.get(act_url).then((response) => {
        console.log("response");
        const html = response.data;
        const $ = cheerio.load(html);
        console.log($.html());
        const pages = [];
        let id = "";
        let optional_id = "";
        console.log("start");

        console.log("in1");
        $("div.facetedbrowse_FacetedBrowseInnerCtn_hWbTI > div").find("div.salepreviewwidgets_SaleItemBrowserRow_y9MSd").map(function (i, e) {
            console.log("in");
            const folio_instance = {};
            // if [appid] not present than find [data-ds-bundleid]
            id = $(e).attr("data-ds-appid");
            folio_instance.id = id;
            $(e).find("div.salepreviewwidgets_StoreSaleWidgetRight_1lRFu").map(function (i, e) {
                console.log("name:", $(e).find("div.salepreviewwidgets_TitleCtn_1F4bc > a > div").text());
                folio_instance.name = $(e).find("div.salepreviewwidgets_TitleCtn_1F4bc > a > div").text();
                folio_instance.release_date = $(e).find("div.col.search_released.responsive_secondrow").text();

                // if discount price is present 
                if ($(e).has("div.col.search_price_discount_combined.responsive_secondrow > div.col.search_price.responsive_secondrow > span > strike").attr() != undefined) {
                    folio_instance.price = $(e).find("div.col.search_price_discount_combined.responsive_secondrow > div.col.search_price.responsive_secondrow > br")[0].nextSibling.nodeValue;
                }
                else {
                    folio_instance.price = $(e).find("div.col.search_price_discount_combined.responsive_secondrow > div.col.search_price.responsive_secondrow").text().trim();
                }
            })

            optional_id = $(e).find("div.col.search_capsule > img").attr("src");
            optional_id = optional_id.slice(optional_id.indexOf("?t=") + 3);
            folio_instance.img = `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg?t=${optional_id}`;
            pages.push(folio_instance);
        });
        res.send(pages);
        res.end();
    }).catch((err) => {
        console.error("err-", err);
        res.end();
    });


});

app.get('/utf', async (req, res) => {
    const act_url = "https://api.steampowered.com/IStoreBrowseService/GetItems/v1?origin=https:%2F%2Fstore.steampowered.com&input_protobuf_encoded=CgQIuJ0XCgQI6NYbCgQIjvUjCgQIosAuCgQI6uQuCgQI%2BNpLCgQIqLhTCgQI7IxjCgQI6ppjCgQIzrt4CgUI1t2CAQoFCIKiiwESDwoHZW5nbGlzaBoCSU4gARoSCAEQARgBKAEwAUAUSAFQAVgB";
    axios.get(act_url).then((response) => {
        // response.body.toString('utf-8');
        console.log(response.data.toString('utf-8'));
        res.send(response.data);
    }).catch((err) => {
        res.send("err:", err);
    });

})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

