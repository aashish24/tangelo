/*jslint browser: true */

/*globals $, tangelo, d3, vg, console */

$(function () {
    "use strict";

    // Appplication object
    var kiva = {};
    kiva.timeslider = null;
    kiva.data = {};
    kiva.format = d3.time.format("%Y-%m-%d %H:%M:%S");

    tangelo.requireCompatibleVersion("0.2");

    // Make the body element the correct size for no scrolling
    d3.select("body").style("height", $(window).height() - 60);

    function adaptTime(timeRangeMsecs) {
        if (!timeRangeMsecs || timeRangeMsecs.length !== 2 ||
             !(timeRangeMsecs instanceof Array)) {
            return [];
        }
        return [kiva.format(new Date(timeRangeMsecs[0])),
                kiva.format(new Date(timeRangeMsecs[1]))];
    }

    function getMinMaxDates(server, db, coll) {
        "use strict";

        // Get the earliest and latest times in the collection, and set the slider
        // range/handles appropriately.
        tangelo.getMongoRange(server, db, coll, "loans:posted_date", function (min, max) {
            // Retrieve the timestamps from the records.
            min = min;
            max = max;

            if(min === "") {
                min = "Jan 01, 1970 00:00:00";
            }

            if(max === "") {
                max = kiva.format(new Date());
            }

            min = Date.parse(min);
            max = Date.parse(max);

            // Set the min and max of the time slider.
            kiva.timeslider.slider("option", "min", min);
            kiva.timeslider.slider("option", "max", max);

            // Set the low slider handle to July 30 (for a good initial setting to
            // investigate the data), and the high handle to the max.
            kiva.timeslider.slider("values", 0, min);
            kiva.timeslider.slider("values", 1, max);
            kiva.timeslider.slider("option", "change", function (evt, ui) {
                var low,
                    high;

                low = ui.values[0];
                high = ui.values[1];

                kiva.displayFunc(low, high);

                // @TODO Update it for kiva
                update(adaptTime([low, high]),
                       d3.select("#count").node().value, "localhost");
            });
        });
    }

    // This function is used to display the current state of the time slider.
    kiva.displayFunc = (function () {
        var lowdiv,
            highdiv;

        lowdiv = d3.select("#low");
        highdiv = d3.select("#high");

        return function (low, high) {
            console.log('low', low);
            console.log('high', high);
            lowdiv.html(tangelo.date.toShortString(new Date(low)));
            highdiv.html(tangelo.date.toShortString(new Date(high)));
        };
    }());

    function updateData(data, host) {
        "use strict";

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
        console.log('data ', data);

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

    function update(timeRange, count, host) {
        "use strict";

        if (!timeRange) {
            // 2012-08-27 12:30:01
            timeRange = [];
            timeRange[0] = kiva.format(new Date(1970, 0, 0));
            timeRange[1] = kiva.format(new Date());
        }

        // Load contries and relevant dataset
        d3.json("world-countries.json", function (error, countries) {
            d3.json("service/kiva/" + host + "/xdata/find/loans?count="+count+"&datemin="+timeRange[0]+"&datemax="+timeRange[1], function (error, loans) {
                d3.json("service/kiva/" + host + "/xdata/find/lenders?count="+count+"&datemin="+timeRange[0]+"&datemax="+timeRange[1], function (error, lenders) {
                    d3.json("service/kiva/" + host + "/xdata/find/lender-loan-links", function (error, llLinks) {
                        // TODO (Choudhary) Make this code modular
                        var i, d, categories = {},
                            noOfCategories, legends = [],
                            legendWidth = 40, legendHeight = 20,
                            legendXOffset = 10, legendYOffset = 10,
                            loansAmountMin = 0, loansAmountMax = 0,
                            lenderCountMin = 0, lenderCountMax = 0,
                            lendersIndexMap = {}, loansIndexMap = {},
                            viewWidth = $("#vis").width(),
                            viewHeight = $("#vis").height();

                        // Initialize
                        kiva.data.nodes = [];
                        kiva.data.edges = [];
                        kiva.data.loans = loans;
                        kiva.data.lenders = lenders;

                        // Generate data object
                        kiva.data.countries = countries.features;

                        var i = 0;
                        if (lenders.length > 0) {
                            // [min, max]
                            kiva.data.lendersCountRange = [lenders[lenders.length - 1][2], lenders[0][2]];
                        }
                        for (i = 0; i < lenders.length; ++i) {
                            lenders[i].type = "Lenders";
                            categories[lenders[i].type] = 1;
                            kiva.data.nodes.push(lenders[i]);

                            if (lenders[i][0] in lendersIndexMap === false) {
                                lendersIndexMap[lenders[i][0]] = i;
                            }
                        }

                        // Loan sector is the fourth value in the array
                        if (loans.length > 0) {
                            // [min, max]
                            kiva.data.loansAmountRange = [loans[loans.length - 1][2], loans[0][2]];
                        }
                        for (i = 0; i < loans.length; ++i) {
                            loans[i].type = loans[i][3];
                            kiva.data.nodes.push(loans[i]);
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
                        kiva.data.legends = legends;

                        // Finally construct links
                        // TODO (Choudhary) This is really crude but we will make it better
                        // later.
                        for (i = 0; i < llLinks.length; ++i) {
                            var link = {};
                            if (llLinks[i][0] in lendersIndexMap &&
                                llLinks[i][1] in loansIndexMap) {
                                link.source = lendersIndexMap[llLinks[i][0]];
                                link.target = loansIndexMap[llLinks[i][1]];
                                kiva.data.edges.push(link);
                            }
                        }

                        updateData(kiva.data, host);
                    });
                });
            });
        });
    }

    kiva.timeslider = $("#time-slider");

    // Create a range slider for slicing by time.  Whenever the slider changes
    // or moves, update the display showing the current time range.  Eventually,
    // the "onchange" callback (which fires when the user releases the mouse
    // button when making a change to the slider position) will also trigger a
    // database lookup, but at the moment we omit that functionality to avoid
    // spurious database lookups as the engine puts the slider together and sets
    // the positions of the sliders programmatically.
    kiva.timeslider.slider({
        range: true,

        change: function (evt, ui) {
            var low,
                high;

            low = ui.values[0];
            high = ui.values[1];

            kiva.displayFunc(low, high);
        },

        slide: function (evt, ui) {
            var low,
                high;

            low = ui.values[0];
            high = ui.values[1];

            kiva.displayFunc(low, high);
        }
    });

    // Load in the default configuration values, county, state, and initial
    // contribution data
    tangelo.defaults("defaults.json", function (defaults) {
        var host = "localhost";
        update(null, d3.select("#count").node().value, "localhost")
        //host = defaults ? defaults["host"] : "localhost";
    });

    // Get min max dates
    getMinMaxDates("localhost", "xdata", "kiva.loans");

    d3.select("#count").on("change", function () {
        console.log("Updating count");
        console.log($( "#time-slider" ).slider( "values" ) );
        update(adaptTime($( "#time-slider" ).slider( "values" )),
            d3.select("#count").node().value, "localhost");
    });
});
