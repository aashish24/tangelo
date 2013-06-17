#!/usr/bin/python

import json
import sys
import pymongo
import re
from bson.objectid import ObjectId

def repl_func(m):
    return m.group(1) + m.group(2).upper()

# Default to localhost
# state_codes = [AL", AK", AZ", AR", CA", CO", CT", DE", FL", GA", HI", ID", IL", IN", IA", KS", KY
#   LA", ME", MD", MA", MI", MN", MS", MO", MT", NE", NV", NH", NJ", NM", NY", NC", ND", OH", OK", OR", PA",
#   RI", SC", SD", TN", TX", UT", VT", VA", WA", WV", WI", WY]

geonames = pymongo.Connection("localhost")["xdata"]["geonames"]
lenders = pymongo.Connection("localhost")["xdata"]["kiva.lenders"]

# Read location information from lenders database and using geonames
# get the lat/lon of that location, and finally add it to the lenders database
for entry in lenders.find({ }, { "_id": 1, "lenders:country_code": 1, "lenders:whereabouts": 1 }):
    # Admin code1 should be the state
    # TODO Should check if we do get a valid admin code
    country = (entry["lenders:country_code"]).strip()
    location = (entry["lenders:whereabouts"][:-2]).strip()
    state = (entry["lenders:whereabouts"][-2:]).strip()
    oid = entry["_id"]
    
    # Print info on inputs
    #print 'id %s country_code %s place %s state %s' % (oid, country, location, state)

    # Use only the first matched result
    result = list(geonames.find({ "country code": country, "place name": location, "admin code1": state},
        { "_id": 0, "latitude": 1, "longitude": 1 }))

    # print 
    latlon_pair = ""
    if len(result) > 0:
        #print 'type of id', type(id)
        #print 'type of id', type(latlon_pair)

        latlon_pair = str(result[0]["latitude"]) + " " + str(result[0]["longitude"])
    lenders.update({ "_id": ObjectId(oid) },{ "$set": { "loans:location:geo:pairs":latlon_pair } })
    print latlon_pair


# sys.stderr.write("== %d blanks" % blank)
# sys.stderr.write("== %d name_country" % name_country)
# sys.stderr.write("== %d place_country_state" % place_country_state)
# sys.stderr.write("== %d place_country" % place_country)
# sys.stderr.write("== %d alternate_name_country" % alternate_name_country)
# sys.stderr.write("== %d alternate_place_country_state" %
#         alternate_place_country_state)
# sys.stderr.write("== %d alternate_place_country" % alternate_place_country)
# sys.stderr.write("== %d not_found" % not_found)
