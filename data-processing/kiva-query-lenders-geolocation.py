import json
import sys
import pymongo
import re

def repl_func(m):
    return m.group(1) + m.group(2).upper()

geonames = pymongo.Connection("localhost")["xdata"]["geonames"]
lenders = pymongo.Connection("localhost")["xdata"]["kiva.lenders"]

blank = 0
name_country = 0
place_country_state = 0
place_country = 0
alternate_name_country = 0
alternate_place_country_state = 0
alternate_place_country = 0
not_found = 0

for lender in lenders.find({ }, { "_id": 1, "lenders:country_code": 1, "lenders:whereabouts": 1 }):
    where = lender["whereabouts"]
    if where:
        where = where.strip()
    country = lender["country_code"]
    if country:
        country = country.strip()
    if where == None or where == "" or country == None or country == "":
        blank = blank + 1
        continue
    where_parts = where.split(" ")
    if where_parts >= 2 and " ".join(where_parts[-2:]) == "British Columbia":
        state = "British Columbia"
        place = " ".join(where_parts[0:-2]).strip()
    elif where_parts >= 2 and " ".join(where_parts[-2:]) == "New York":
        state = "NY"
        place = " ".join(where_parts[0:-2]).strip()
    else:
        state = where_parts[-1]
        place = " ".join(where_parts[0:-1]).strip()
    where = re.sub("(^|\s)(\S)", repl_func, where.lower())
    place = re.sub("(^|\s)(\S)", repl_func, place.lower())
    found = False
    lat = 0
    lng = 0
    if not found:
        for d in geonames.find({"name": where, "country_code": country,
                "feature_class": "P"},
                sort=[("population", -1)], fields=["latitude", "longitude"]):
            lat = d["latitude"]
            lng = d["longitude"]
            name_country = name_country + 1
            found = True
            break
    if not found and place != "":
        for d in geonames.find({"name": place, "country_code": country,
                "feature_class": "P",
                "admin1_code": state}, sort=[("population", -1)],
                fields=["latitude", "longitude"]):
            lat = d["latitude"]
            lng = d["longitude"]
            place_country_state = place_country_state + 1
            found = True
            break
    if not found and place != "":
        for d in geonames.find({"name": place, "country_code": country,
                "feature_class": "P"},
                sort=[("population", -1)], fields=["latitude", "longitude"]):
            lat = d["latitude"]
            lng = d["longitude"]
            place_country = place_country + 1
            found = True
            break
    if not found:
        for d in geonames.find({"alternate": where, "country_code": country,
                "feature_class": "P"},
                sort=[("population", -1)], fields=["latitude", "longitude"]):
            lat = d["latitude"]
            lng = d["longitude"]
            found = True
            alternate_name_country = alternate_name_country + 1
            break
    if not found and place != "":
        for d in geonames.find({"alternate": place, "country_code": country,
                "feature_class": "P",
                "admin1_code": state}, sort=[("population", -1)],
                fields=["latitude", "longitude"]):
            lat = d["latitude"]
            lng = d["longitude"]
            alternate_place_country_state = alternate_place_country_state + 1
            found = True
            break
    if not found and place != "":
        for d in geonames.find({"alternate": place, "country_code": country,
                "feature_class": "P"},
                sort=[("population", -1)], fields=["latitude", "longitude"]):
            lat = d["latitude"]
            lng = d["longitude"]
            alternate_place_country = alternate_place_country + 1
            found = True
            break
    if not found:
        not_found = not_found + 1
        sys.stderr.write("not found: \"%s\" \"%s\"\n" % (where, country))
        continue


    oid = lender["_id"]
    if found:
        latlon_pair = str(lat) + " " + str(lng)
    else:
        latlon_pair = ""
    print 'found ', latlon_pair
    lenders.update({ "_id": ObjectId(oid) },{ "$set": { "lenders:location:geo:pairs":latlon_pair } })
