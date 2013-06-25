/*jslint browser: true */

/*globals $, tangelo, d3, vg, console */

$(function () {
    "use strict";

    // Appplication object
    var kiva = {};
    kiva.view = null;
    kiva.statsView = null;
    kiva.host = null;
    kiva.timeslider = null;
    kiva.data = {};
    kiva.statsData = {};
    kiva.format = d3.time.format("%Y-%m-%d %H:%M:%S");
    kiva.loanAmountDisplayThreshold = 25000;
    kiva.loanCountDisplayThreshold = 2000;

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

    /**
     * Compute min and max dates for a particular field
     */
    function getMinMaxDates(server, db, coll, field) {
        "use strict";

        // Get the earliest and latest times in the collection, and set the slider
        // range/handles appropriately.
        tangelo.getMongoRange(server, db, coll, field, function (min, max) {
            // Retrieve the timestamps from the records.
            min = min;
            max = max;

            if(min === "") {
                min = "2005-04-15 01:00:00";
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
            lowdiv.html(tangelo.date.toShortString(new Date(low)));
            highdiv.html(tangelo.date.toShortString(new Date(high)));
        };
    }());

    /**
     * Update data for the visualization
     */
    function updateData() {
        "use strict";

        // Update visualization
        console.log('Updated data ', kiva.data);
        console.log('Updated data ', kiva.statsData);

        // TODO(Choudhary) For some reason, if we don't recreate the view
        // then the nodes don't get drawn using update method
        {
            vg.parse.spec("choropleth.json", function (chart) {
                kiva.view = chart({el: "#vis", data: kiva.data}).update();
            });
        }

        // TODO(Choudhary) For some reason, if we don't recreate the view
        // the texts on the y axis does not get updated
        {
            vg.parse.spec("stats.json", function (chart) {
                kiva.statsView = chart({el: "#stats", data: kiva.statsData}).update();
            });
        }
    }

    /**
     * Initialize visualization
     */
    function init() {
        "use strict";

        d3.json("world-countries.json", function (error, countries) {
            kiva.data.countries = countries.features;

            update(null, d3.select("#count").node().value, "localhost");

            // Get min max dates
            getMinMaxDates(kiva.host, "xdata", "kiva.loans", "loans:posted_date");
        });
    }

    /**
     * Load new data from the database and prepare it for visualization
     */
    function update(timeRange, count, host) {
        "use strict";
        var loansUrl = "",
            lendersUrl = "",
            lenderLoanLinksUrl = "";

        d3.select("#abort")
            .classed("btn-success", false)
            .classed("btn-danger", true)
            .classed("disabled", false)
            .html("Running query <i class=\"icon-repeat icon-white spinning\"></i>");

        if (!timeRange) {
            // 2012-08-27 12:30:01
            timeRange = [];
            timeRange[0] = kiva.format(new Date(1970, 0, 0));
            timeRange[1] = kiva.format(new Date());
        }

        // Load relevant dataset
        loansUrl = "service/kiva/" + host + "/xdata/find/loans?count=" + count +
            "&datemin=" + timeRange[0] + "&datemax=" + timeRange[1];
        lendersUrl = "service/kiva/" + host + "/xdata/find/lenders?count=" + count +
            "&datemin=" + timeRange[0] + "&datemax=" + timeRange[1];
        lenderLoanLinksUrl = "service/kiva/" + host + "/xdata/find/lender-loan-links";

        d3.json(loansUrl, function (error, loans) {
            d3.json(lendersUrl, function (error, lenders) {
                d3.json(lenderLoanLinksUrl, function (error, llLinks) {
                    var i, d, categories = {},
                        noOfCategories, legends = [],
                        legendWidth = 40, legendHeight = 20,
                        legendXOffset = 10, legendYOffset = 10,
                        loansAmountMin = 0, loansAmountMax = 0,
                        lenderCountMin = 0, lenderCountMax = 0,
                        lendersIndexMap = {}, loansIndexMap = {},
                        viewWidth = $("#vis").width(),
                        viewHeight = $("#vis").height();

                    // Initialize / reset
                    kiva.data.nodes = [];
                    kiva.data.edges = [];
                    kiva.data.loans = loans;
                    kiva.data.lenders = lenders;
                    kiva.statsData.topLoans = [];

                    var i = 0;
                    if (lenders.length > 0) {
                        // [min, max]
                        kiva.data.lendersCountRange = [lenders[lenders.length - 1][2], lenders[0][2]];
                    }
                    for (i = 0; i < lenders.length; ++i) {
                        if (lenders[i][2] > kiva.loanCountDisplayThreshold) {
                            lenders[i].label = (lenders[i][2]).toString();
                        } else {
                            lenders[i].label = "";
                        }
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

                        if (loans[i][2] < kiva.loanAmountDisplayThreshold) {
                            loans[i].label = "";
                        } else {
                            loans[i].label = (loans[i][2]).toString();
                        }

                        if (kiva.statsData.topLoans.length < 5) {
                            var prevIndex = kiva.statsData.topLoans.length - 1;
                            if (prevIndex === -1 ||
                                (kiva.statsData.topLoans[prevIndex].value !== loans[i][2])) {
                                var topLoan = {};
                                topLoan.label = (prevIndex + 1).toString() + "-" + loans[i][3];
                                topLoan.value = loans[i][2];
                                kiva.statsData.topLoans.push(topLoan);
                            }
                        }

                        loans[i].type = loans[i][3];
                        kiva.data.nodes.push(loans[i]);
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
                    // TODO (Choudhary) This is not optimized but will do it later.
                    // It may be possible to do this on the server itself
                    for (i = 0; i < llLinks.length; ++i) {
                        var link = {};
                        if (llLinks[i][0] in lendersIndexMap &&
                            llLinks[i][1] in loansIndexMap) {
                            link.source = lendersIndexMap[llLinks[i][0]];
                            link.target = loansIndexMap[llLinks[i][1]];
                            link.borrowerCount = Math.sqrt(llLinks[i][2]);
                            kiva.data.edges.push(link);
                        }
                    }

                    var N = kiva.data.nodes.length;
                    d3.select("#abort")
                        .classed("btn-danger", false)
                        .classed("btn-success", true)
                        .classed("disabled", true)
                        .text("Got " + N + " result" + (N === 0 || N > 1 ? "s" : ""));

                    updateData();
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
        kiva.host = "localhost";
        init();
    });

    d3.select("#count").on("change", function () {
        update(adaptTime($( "#time-slider" ).slider( "values" )),
            d3.select("#count").node().value, "localhost");
    });
});
