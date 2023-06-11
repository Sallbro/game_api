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
app.get('/search/:sugg', async (req, res) => {
    const sugg = req.params.sugg;
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
        res.status(200).send(result);
        res.end();

    }).catch((err) => {
        console.error(err);
        res.end();
    });

});

//reviews games
app.get('/:id/reviews/:category/:limit', (req, res) => {

    const id = req.params.id;
    const category = req.params.category;
    const limit = req.params.limit;

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
        for (var i = 2; i <= Math.ceil((Number(limit) / 10)); i++) {
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

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});


