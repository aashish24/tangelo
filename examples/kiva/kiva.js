/*jslint browser: true */

/*globals $, tangelo, d3, vg, console */

$(function () {
    "use strict";

    tangelo.requireCompatibleVersion("0.2");

    // Make the body element the correct size for no scrolling
    d3.select("body").style("height", $(window).height() - 60);

    function updateData(data, host) {
        var view,
            donorMap = {},
            date,
            charity = null,
            charityMaxMonth = 10000000,
            dates,
            numFormat = d3.format("02d"),
            playing,
            timerId,
            time,
            i,
            d,
            normalize = false;

        // Generate the visualization
        // console.log('data ', data);

        vg.parse.spec("choropleth.json", function (chart) {
            chart({el: "#vis", data: data}).update();

            // var padding = {};
            // padding.top = ($(window).height() - 60 - 500) / 2;
            // padding.left = ($(window).width() - 960) / 2;
            // padding.bottom = padding.top;
            // padding.right = padding.left;

            // view = chart({el: "#vis", data: data}).width(960).height(500).padding(padding).update();

            // // time = d3.select("#time").node();
            // // date = dates[time.selectedIndex];

            // console.log('data', data);
            // //updateDate();
            // if (playing) {
            //     timerId = setInterval(updater, 2000);
            // }
        });
    }

    function update(count, host) {
        // Load contries and relevant dataset
        d3.json("world-countries.json", function (error, countries) {
            d3.json("service/kiva/" + host + "/xdata/find/loans?count="+count, function (error, loans) {
                d3.json("service/kiva/" + host + "/xdata/find/lenders?count="+count, function (error, lenders) {
                    d3.json("service/kiva/" + host + "/xdata/find/lender-loan-links", function (error, llLinks) {
                        // TODO (Choudhary) Make this code modular
                        var i, d, data = {}, categories = {},
                            noOfCategories, legends = [],
                            legendWidth = 40, legendHeight = 20,
                            legendXOffset = 10, legendYOffset = 10,
                            loansAmountMin = 0, loansAmountMax = 0,
                            lenderCountMin = 0, lenderCountMax = 0,
                            lendersIndexMap = {}, loansIndexMap = {},
                            viewWidth = $("#vis").width(),
                            viewHeight = $("#vis").height();

                        // Initialize
                        data.nodes = [];
                        data.edges = [];
                        data.loans = loans;
                        data.lenders = lenders;

                        // Generate data object
                        data.countries = countries.features;

                        var i = 0;
                        if (lenders.length > 0) {
                            // [min, max]
                            data.lendersCountRange = [lenders[lenders.length - 1][2], lenders[0][2]];
                        }
                        for (i = 0; i < lenders.length; ++i) {
                            lenders[i].type = "Lenders";
                            categories[lenders[i].type] = 1;
                            data.nodes.push(lenders[i]);

                            if (lenders[i][0] in lendersIndexMap === false) {
                                lendersIndexMap[lenders[i][0]] = i;
                            }
                        }

                        // Loan sector is the fourth value in the array
                        if (loans.length > 0) {
                            // [min, max]
                            data.loansAmountRange = [loans[loans.length - 1][2], loans[0][2]];
                        }
                        for (i = 0; i < loans.length; ++i) {
                            loans[i].type = loans[i][3];
                            data.nodes.push(loans[i]);
                            // console.log('loans[i].type in categories', categories, loans[i].type in categories);
                            if (loans[i].type in categories === false) {
                                categories[loans[i].type] = 1;
                            }

                            if (loans[i][0] in loansIndexMap === false) {
                                loansIndexMap[loans[i][0]] = i + lenders.length;
                            }
                        }

                        // Compute x and y for legendXOffset
                        noOfCategories = Object.keys(categories).length;
                        i = 0;
                        for (var key in categories) {
                            var legend = {};
                            legend.x = legendXOffset;
                            legend.width = legendWidth;
                            legend.y = (i + 1) * legendYOffset + i * legendHeight;
                            legend.y2 = legend.y + legendHeight;
                            legend.text = key;
                            legend.x_text = legend.x + legendWidth;
                            legend.y_text = legend.y + legendHeight * 0.5;
                            legends.push(legend);
                            ++i;
                        }
                        data.legends = legends;

                        // Finally construct links
                        // TODO (Choudhary) This is really crude but we will make it better
                        // later.
                        for (i = 0; i < llLinks.length; ++i) {
                            var link = {};
                            if (llLinks[i][0] in lendersIndexMap &&
                                llLinks[i][1] in loansIndexMap) {
                                link.source = lendersIndexMap[llLinks[i][0]];
                                link.target = loansIndexMap[llLinks[i][1]];
                                data.edges.push(link);
                            }
                        }

                        updateData(data, host);
                    });
                });
            });
        });
    }

    // Load in the default configuration values, county, state, and initial
    // contribution data
    tangelo.defaults("defaults.json", function (defaults) {
        var host = "localhost";
        update(d3.select("#count").node().value, "localhost")
        //host = defaults ? defaults["host"] : "localhost";
    });

    d3.select("#count").on("change", function () {
        console.log("Updating");
        update(d3.select("#count").node().value, "localhost");
    });
});
