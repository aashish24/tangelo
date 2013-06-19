import bson.json_util
import datetime
import pymongo
import json
import cherrypy

import tangelo

def run(servername, dbname, type, datatype, querydata = None, collection = None, by = None, datemin = None, datemax = None):
    # Construct an empty response object.
    response = tangelo.empty_response();

    # Establish a connection to the MongoDB server.
    try:
        conn = pymongo.Connection(servername)
    except pymongo.errors.AutoReconnect as e:
        response['error'] = "error: %s" % (e.message)
        return bson.json_util.dumps(response)

    # Extract the requested database and collection.
    db = conn[dbname]

    # (Chaudhary) Clean up this code. Currently the goal
    # is to get the data in the right format for the visualization.
    if type == "find":
        # Current we support three types of datatypes: loans,
        # lenders, and lender-loan-links

        # Perform find operation on loans
        if datatype == "loans":
            cherrypy.log("Processing find query for datatype " + datatype)
            coll = db["kiva.loans"]
            # For now assume that we need to return only certain parameters
            result = coll.find({ }, { "_id": 0, "loans:id": 1,
                "loans:location:geo:pairs": 1,
                "loans:loan_amount": 1,
                "loans:sector": 1,
                "loans:id": 1 }).limit(1000)
            result.sort("loans:loan_amount", -1)

            response = [["%s" % d["loans:id"], [float(x)
                for x in d["loans:location:geo:pairs"].split()],
                float(d["loans:loan_amount"]),
                str(d["loans:sector"]),
                str(d["loans:id"])] for d in result if d["loans:id"] != None]

        # Perform find operation on lenders
        if datatype == "lenders":
            cherrypy.log("Processing find query for datatype " + datatype)
            coll = db["kiva.lenders"]
            result = coll.find({ "loans:location:geo:pairs": { "$exists": "true" } }, {
                "_id": 0, "lenders:loan_count": 1,
                "lenders:lender_id":1,
                "loans:location:geo:pairs":1}).limit(1000)
            result.sort("lenders:loan_count", -1)

            response = [["%s" % d["lenders:lender_id"],
                [float(x) for x in d["loans:location:geo:pairs"].split()],
                float(d["lenders:loan_count"])] for d in result if d["lenders:lender_id"] != None]

        # Pefrom find operation on lender loan links data
        if datatype == "lender-loan-links":
            cherrypy.log("Processing find query for datatype " + datatype)
            coll = db["kiva.lenders"]
            lenders = coll.find({ "loans:location:geo:pairs": { "$exists": "true" } }, {
                "_id": 0, "lenders:lender_id":1 }).limit(1000)
            lenders = ["%s" % d["lenders:lender_id"] for d in lenders if d["lenders:lender_id"] != None]
            coll = db["kiva.lender.loan.links"]
            cherrypy.log('lenders', str(list(lenders)))
            result = coll.find({ "id" : { "$in" : list(lenders) } }, {
                "_id": 0, "id": 1,
                "loans:id":1,
                "loans:borrower_count":1}).limit(10000)

            response = [["%s" % d["id"], "%s" % d["loans:id"], float(d["loans:borrower_count"])]
                for d in result if d["id"] != None]

    # Perform aggregation type queries
    elif type == "aggregate":
        if datatype == "lenders":
            coll = db["kiva.lenders"]
            conditions = [{"member_since": {"$ne": None}}];
            if datemin != None and datemax != None:
                date_min = datetime.datetime.strptime(datemin, "%Y-%m-%d")
                date_max = datetime.datetime.strptime(datemax, "%Y-%m-%d")
                conditions.append({"date": {"$gte": date_min}})
                conditions.append({"date": {"$lt": date_max}})
            if lenders != None:
                conditions.append({"lenders_id": int(lenders)})
            pipeline = []
            if len(conditions) > 0:
                pipeline.append({"$match": {"$and": conditions}})
            if by == "month":
                group = {"year": {"$year": "$date"}, "month": {"$month": "$member_since"}}
            else:
                group = "$country_code"
            print 'pipeline', pipeline
            pipeline.append({"$group": {"_id": group, "amount": {"$sum": "$loan_count"}}})
            result = coll.aggregate(pipeline)
            if by == "month":
                response = [[d["_id"], float(d["loan_count"])] for d in result["result"] if d["_id"] != None]
            else:
                # print 'result ', result
                # response = result
                response = [["%s" % d["_id"], float(d["amount"])] for d in result["result"] if d["_id"] != None]
        elif datatype == "population":
            coll = db["census"]
            response = [[d["_id"], int(d["pop2010"])] for d in coll.find()]
        elif datatype == "charities":
            coll = db["charitynet.normalized.transactions"]
            result = coll.aggregate([{"$group": {"_id": "$charity_id", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}])
            response = [[d["_id"], d["_id"], d["count"]] for d in result["result"]]
        else:
            response['error'] = "error: unknown datatype requested"

    # Convert to JSON and return the result.
    return bson.json_util.dumps(response)
