# Generic api

(Rough sketch v1)

Note: All logic is blocking, i.e validation is blocking, can be changed to async pattern too!

# Important files:

config.js contains example config for a resource.

```eg: config.js
	module.exports = {
		PAGE_SIZE: 10,
		DEMO_CONFIG: {
			model: 'User',
			enableModifiers: true,
			modifierRules: { slug: ['slugify', 'uppercase'] },
			methods: ['get', 'post', 'put'],
			path: '/user',
			paramsArray: ['id', 'email', 'name'],
			paramsRulesList: {
				name: {
					rules: [{ name: 'length', max: 3, min: 2 }]
				},
				email: {
					rules: [{ name: 'email' }]
				}
			}
	}
}```

You can create new instance of generic-api for different resources. A resource in this context refers to an entity like User, Car, Product etc.

# Steps to use

require('yo-generic-api')
const Resource = require('yo-generic-api').Resource;
const user = new Resource()
user.init(app, config)

## Note: app parameter should have mongoose model attached for database calls to work. Eg: app.db.models.User
