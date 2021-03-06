import cherrypy
import os.path
import sys

# This function defines the structure of a service response.  Each service
# module should import this function from this package.
#
# The payload is contained in the 'result' field, while the 'error' field can
# indicate that something went wrong.  Posibly more fields could be added in the
# future.
def empty_response():
    return {'result' : None,
            'error' : None}

def content_type(t=None):
    r = cherrypy.response.headers['Content-type']

    if t is not None:
        cherrypy.response.headers['Content-type'] = t

    return r

def log(*pargs, **kwargs):
    cherrypy.log(*pargs, **kwargs)

def request_path():
    return cherrypy.request.path_info

# TODO(choudhury): this leaves a global variable open for anyone to modify;
# there's a crazy hack (sanctioned by Guido himself) that lets us get around it:
# http://stackoverflow.com/questions/2447353/getattr-on-a-module (Ethan Furman's
# answer), which references this email:
# http://mail.python.org/pipermail/python-ideas/2012-May/014969.html
_modulepath = None
def modulepath(mp):
    global _modulepath
    _modulepath = mp

_webroot = None
def set_webroot(r):
    global _webroot
    _webroot = r

def webroot():
    return _webroot

def paths(runtimepaths):
    home = os.path.expanduser("~").split(os.path.sep)[:-1]
    root = webroot()

    # This function returns an absolute path if the path is allowed (i.e., in
    # someone's tangelo_html directory, or under the web root directory), or
    # logs a complaint and returns None otherwise.
    def good(path):
        orig = path
        if os.path.isabs(path):
            log("Illegal path (absolute): %s" % (orig), "SERVICE")
            return None

        path = os.path.abspath(_modulepath + os.path.sep + path)
        if len(path) >= len(root) and path[:len(root)] == root:
            return path

        comp = path.split(os.path.sep)
        if len(comp) >= len(home) + 2 and comp[:len(home)] == home and comp[len(home)+1] == "tangelo_html":
            return path

        log("Illegal path (outside of web space): %s" % (orig), "SERVICE")
        return None

    # Construct the list of new runtime paths by first mapping the checker over
    # the list, then throwing away any Nones that showed up (the paths that led
    # to Nones will have been logged).
    newpaths = filter(lambda x: x is not None, map(good, runtimepaths))

    # Finally, augment the path list.
    sys.path = newpaths + sys.path

class HTTPStatusCode:
    def __init__(self, code, msg=None):
        self.code = code
        self.msg = msg

# A decorator that exposes functions as being part of a service's RESTful API.
def restful(f):
    f.restful = True
    return f
