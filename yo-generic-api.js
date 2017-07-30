var constants = require('./demo-config');
var mongoose = require('mongoose');
var slugify = require('slugify');
const async = require('async');

var methodsList = [];
var paths = [];
var paramsList = [];
var paramsRulesList = {};
var modifiersList = {};
var model = null;
var modifiers = false;
var modifierRules = {};
let middlewares = [];

var self = module.exports.Resource = function() {

    /* Text name of the model: @_model */
    this.init = (app, config) => {
            this.model(config.model);
            this.enableModifiers(config.enableModifiers, config.modifierRules);
            this.methods(config.methods);
            //this.registerMiddleWares(config.middlewares);
            this.registerRoutes(app, config.path, config.paramsArray);
            this.setParamRulesList(config.paramsRulesList);
        },

        this.model = (_model) => {
            model = _model;
        },

        this.enableModifiers = (_set, rules) => {
            modifiers = _set;
            modifierRules = rules;
        },

        this.setMiddlewares = (_middlewares = []) => {
            middlewares = _middlewares;
        },

        this.methods = (_methodsList) => {
            methodsList = _methodsList;
        },

        this.setParamRulesList = (list) => {
            paramsRulesList = list;
        },

        /* This just works with level 1 params, for multilevel params, need to think about data structure, will do so in next sitting */
        this.registerRoutes = (app, _path, _paramsList) => {

            paramsList = _paramsList;
            paths.push(_path); // Add default path
            _paramsList.forEach((param, index) => {
                paths.push(`${_path}/${param}/:${param}`);
            });

            methodsList.forEach((method) => {
                for (var i = 0; i < paths.length; i++) {
                    app[method](paths[i], this.requestHandler);
                    console.log(paths[i] + '    <--- ' + method);
                    //if(method === 'put') // We want default route for put, thus we break after it
                    //	break;

                }
            });
            return paths;
        },
        /*All middlewares that will be fired before hitting routes */
        this.registerMiddleWares = (app) => {
            app.use((req, res, next) => {
                middlewares.forEach((item) => {
                    item.bind(null, req, res);
                });

                async.series(middlewares, function(err) {
                    if (err) {
                        console.log('There was a problem running the middleware!');
                        return next(err);
                    }
                    // all middleware has been run
                    next();
                });
            });
        },

        this.validateRulesListMisMatch = (_paramsRulesList) => {

            var errors = [];

            /* Fist check if parameters list matches rules list */
            for (var param in _paramsRulesList) {
                if (_paramsRulesList.hasOwnProperty(param)) {
                    if ((paramsList.indexOf(param) === -1)) {
                        errors.push("Parameter " + param + " does not exist in the parameter list");
                        break;
                    }
                }
            }

            return errors;
        },

        this.validateParams = (query, params) => {
            var errors = [];
            console.log('Validating params');
            console.log(params);
            var self = this;
            params.forEach(function(param, index) {
                var rules = paramsRulesList[param] !== undefined ? paramsRulesList[param].rules : []; // change access method depending upon data structure of paramsRulesList

                rules.forEach((rule) => {

                    var ruleError = self.ruleValidation(rule, param, query[param]);
                    console.log(ruleError);
                    if (ruleError !== '') {
                        errors.push(ruleError);
                    }
                });
            });
            return errors;
        },



        this.requestHandler = (req, res, next) => {

            //this.cleanParams(req);
            if (Object.keys(req.query).length !== 0) {
                this.requestHandlerWithQueryParams(req, res, next);
            } else {
                this.requestHandlerWithoutQueryParams(req, res, next);
            }
        },

        this.ruleValidation = (rule, param, value) => {

            var error = '';
            var ruleName = rule.name;
            console.log('validating rule: ' + rule.name + ' for param: ' + param);

            switch (ruleName) {
                case 'length':
                    //console.log('validating: '+ ruleName + value.length);
                    if (value.length > rule.max)
                        error = 'Length exceeded for param: ' + param;
                    else if (value.length < rule.min)
                        error = 'Length should be atleast: ' + rule.min + ' for param: ' + param;
                    break;

                case 'email':
                    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                    if (!(re.test(value)))
                        error = 'Invalid email parameter: ' + param;
                    break;

                case 'specialChars':

                    break;

                default:

                    break;
            }

            return error;
        },

        this.requestHandlerWithQueryParams = (req, res, next) => {
            /* Before validating actual params, validate whether params and rules already exist by  using validateRulesListMisMatch function */
            var misMatchErrors = this.validateRulesListMisMatch(paramsRulesList);
            if (misMatchErrors.length > 0) {
                /* Rules and params mismatch happened */
                return res.json(misMatchErrors);
            }

            var paramsRulesErrors = this.validateParams(req.query, Object.keys(req.query));
            if (paramsRulesErrors.length > 0) {
                return res.json(paramsRulesErrors);
            }

            /* If parameter vaidation passes, do something below  like db access*/
            var args = {};
            /*args.operator = req.query.operator;
            args.page = req.query.page;
            args.sort = req.query.sort;
            args.by = req.query.by;*/
            //delete req.query['operator']; // Have to do this as everything is being handled by querystring
            args.params = Object.assign({}, req.query);
            args.body = Object.assign({}, req.body);

            switch (req.method.toLowerCase()) {
                case 'get':
                    console.log('GET query with params');
                    console.log(args);
                    this.getWithParams(args, req.app.db, (err, success) => {
                        if (err)
                            return next(err);
                        return res.json(success);
                    });
                    break;

                case 'put':
                    console.log('PUT query with params');
                    this.updateWithParams(args, req.app.db, (err, success) => {
                        if (err)
                            return next(err);
                        return res.json(success);
                    });
                    break;

                case 'post':
                    //action = putDBActions[req.body.action];
                    break;

                case 'delete':
                    console.log('DELETE query with params', args);
                    if (args.params.operator && args.params.operator === 'in') {
                        this.deleteManyByHint(args, req.app.db, (err, success) => {
                            if (err) return next(err);
                            return res.status(200).json(success);
                        });
                    } else {
                        this.deleteWithParams(args, req.app.db, (err, success) => {
                            if (err) return next(err);
                            return res.status(200).json(success);
                        });
                    }

                    break;

                default:

                    break;
            }
        },

        this.requestHandlerWithoutQueryParams = (req, res, next) => {

            var args = {};
            args.body = req.body;
            args.page = req.body.page || req.page;
            args.sortBy = req.body.sort || req.sort;
            args.by = req.body.by;

            switch (req.method.toLowerCase()) {

                case 'get':
                    console.log('GET query without params');
                    this.getWithoutParams(args, req.app.db, (err, success) => {
                        if (err)
                            return next(err);
                        return res.json(success);
                    });
                    break;

                case 'post':
                    console.log('POST query without params');
                    this.createResource(args, req.app.db, (err, success) => {
                        if (err)
                            return next(err);
                        return res.json(success);
                    });
                    break;

                case 'delete':
                    console.log('DELETE query without params');
                    break;

                default:

                    break;
            }
        },

        this.cleanParams = (params) => {

            delete params.page;
            delete params.sort;
            delete params.operator;
            delete params.by;
        },

        this.getWithoutParams = (args, db, callback) => {
            var page = args.page || 0;
            var sortBy = args.sortBy || 'createdAt';
            /* Use sort for performance gains in this query */
            db[model].pagedFind({
                filters: {},
                page: page,
                limit: constants.PAGE_SIZE,
                sort: {
                    [sortBy]: 1
                }
            }, (err, data) => {
                if (err)
                    return callback(err);
                return callback(null, data);
            });
        },

        this.getWithParams = (args, db, callback) => {

            //var call = Object.keys(args.params).length > 1 ? 'find' : 'findOne';
            var page = args.params.page || 0;
            var sortBy = args.params.sort || 'createdAt';
            var query = this.createQuery(args.params, args.params.operator);

            db[model]['pagedFind']({
                filters: query,
                page: page,
                limit: constants.PAGE_SIZE,
                sort: {
                    [sortBy]: 1
                }
            }, (err, success) => {
                if (err)
                    return callback(err);
                callback(null, success);
            });
            console.log('Query with params: ' + JSON.stringify(query));
        },

        this.updateWithParams = (args, db, callback) => {
            var query = this.createQuery(args.params, args.params.operator);
            db[model].update(query, args.body, (err, success) => {
                if (err)
                    return callback(err);
                callback(null, success);
            });
        },

        this.createResource = (args, db, callback) => {

            var resource = args.body || {};

            if (modifiers)
                this.applyModifiers(resource, modifierRules);
            console.log(resource);
            db[model].create(resource, (err, success) => {
                if (err)
                    return callback(err);
                callback(null, success);
            });
        },

        this.deleteWithParams = (args, db, callback) => {

            var query = this.createQuery(args.params,
                args.params.operator,
                args.params.by,
                args.body[`${args.params.by}`]);
            db[model].deleteMany(query, (err, success) => {
                if (err)
                    return callback(err);
                return callback(null, success);
            });
        },

        this.deleteManyByHint = (args, db, callback) => {
            const query = this.createQuery(args.params,
                args.params.operator,
                args.params.by,
                args.body[`${args.params.by}`]);

            db[model].remove(query, (err, success) => {
                if (err) return callback(err);
                const deleted = success.result.n;
                const prepend = deleted > 1 ? 's' : '';
                return callback(null, { status: deleted > 0 ? 1 : 0, message: `${deleted} Item${prepend} deleted` });
            });
        },

        this.createQuery = (params, operator, operatorHint = null, fieldArray = []) => {

            /* If we have more than one param*/
            const _operator = operator ? operator.slice() : null;
            const _operatorHint = operatorHint ? operatorHint.slice() : null;
            const _fieldArray = fieldArray.length > 0 ? fieldArray.slice() : [];

            this.cleanParams(params);
            var query = {};
            var totalKeys = Object.keys(params).length;

            if (totalKeys > 1) {
                switch (_operator) {
                    case 'and':
                        /* create query object for and operator */
                        query['$and'] = [];
                        for (var key in params) {
                            query['$and'].push({
                                [key]: params[key]
                            });
                        }

                        break;

                    case 'or':
                        query['$or'] = [];
                        for (var key in params) {
                            query['$or'].push({
                                [key]: params[key]
                            });
                        }
                        break;

                    default:
                        console.log(operator);
                        break;
                }
            } else if (_operator === 'in') {
                const opHint = _operatorHint === 'id' ? `_${_operatorHint}` : _operatorHint;

                if (_fieldArray.length > 0) {
                    query[opHint] = {};
                    query[opHint]['$in'] = [];

                    _fieldArray.forEach((item) => {
                        query[opHint]['$in'].push(item);
                    });
                } else {
                    console.log('Error: ', `${opHint} is missing in body`);
                }
            } else {
                // For only single key
                for (var key in params) {
                    if (key === 'id') {
                        query[`_${key}`] = new mongoose.mongo.ObjectId(params[key]);
                    } else {
                        query[key] = params[key];
                    }
                }

            }
            return query;
            console.log(JSON.stringify(query));
        },

        this.applyModifiers = (resource, rules) => {
            console.log('applying modifiers');
            //console.log(rules);
            for (var key in resource) {

                var rulesArray = rules[key] !== undefined ? rules[key] : [];

                rulesArray.forEach((rule, index) => {
                    switch (rule) {
                        case 'slugify':
                            console.log('slugifying');
                            resource[key] = slugify(resource[key]).toLowerCase();
                            break;

                        case 'uppercase':
                            resource[key] = resource[key].toUpperCase();
                            break;

                        case 'lowercase':

                            break;

                        default:

                            break;
                    }
                });

            } // outer loop ends
        }

}