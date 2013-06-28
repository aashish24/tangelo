#!/usr/bin/python

import json
import sys
import pymongo
import re
from bson.objectid import ObjectId

def repl_func(m):
    return m.group(1) + m.group(2).upper()

geonames = pymongo.Connection("localhost")["xdata"]["geonames"]
lenders = pymongo.Connection("localhost")["xdata"]["kiva.lenders"]
cache = {}

# Read location information from lenders database and using geonames
# get the lat/lon of that location, and finally add it to the lenders database
for entry in lenders.find({ }, { "_id": 1, "lenders:country_code": 1, "lenders:whereabouts": 1 }):
    # Admin code1 should be the state
    # TODO Should check if we do get a valid admin code
    country = (entry["lenders:country_code"]).strip()
    place = (entry["lenders:whereabouts"]).strip()
    location = (entry["lenders:whereabouts"][:-2]).strip()
    state = (entry["lenders:whereabouts"][-2:]).strip()
    oid = entry["_id"]

    # Print info on inputs
    #print 'id %s country_code %s place %s state %s' % (oid, country, location, state)

    key = (country, state, location)
    latlon_pair = ""

    if key in cache:
        latlon_pair = cache[key]
    else:
        # Search using the city name, state, and country name
        result = list(geonames.find({ "country code": country, "place name": location, "admin code1": state},
            { "_id": 0, "latitude": 1, "longitude": 1 }))

        if len(result) == 0:
            # Search using the place name, and country name
            result = list(geonames.find({ "country code": country, "place name": place},
                { "_id": 0, "latitude": 1, "longitude": 1 }))

        if len(result) > 0:
            # Use only the first matched result
            latlon_pair = str(result[0]["latitude"]) + " " + str(result[0]["longitude"])

    lenders.update({ "_id": ObjectId(oid) },{ "$set": { "lenders:location:geo:pairs":latlon_pair } })
    print "Found latitude longitude for place %s country %s value %s" % (place, country, latlon_pair)
    cache[key] = latlon_pair

