const instance_skel = require('../../instance_skel')
const jp = require('jsonpath')

// early draft, not fully functional
//TODO: attempt to access the internal variable choices from the bitfocus-companion module
//TDOD: rewrite to classes (no prototype)
//TODO: replace system.emit and system.on calls with normal method calls
//TODO: correct the package.json file (authors, links etc.)

function instance(system, id, config) {
	let self = this

	self.system = system
	
	// super-constructor
	instance_skel.apply(this, arguments)

	self.init()

	self.custom_variables = {}

	system.on('custom_variables_update', self.custom_variable_list_update)
	self.custom_variable_list_update()



	return self
}

instance.prototype.init = function () {
	let self = this

	self.status(self.STATE_OK)
}

// Return config fields for web config
instance.prototype.config_fields = function () {
	let self = this

	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module exposes internal functions of companion and does not have any configuration options',
		},
	]
}

instance.prototype.addSystemCallback = function (name, cb) {
	let self = this

	if (self.callbacks[name] === undefined) {
		self.callbacks[name] = cb.bind(self)
		self.system.on(name, cb)
	}
}

instance.prototype.removeAllSystemCallbacks = function () {
	let self = this

	for (let key in self.callbacks) {
		self.system.removeListener(key, self.callbacks[key])
		delete self.callbacks[key]
	}
}

instance.prototype.custom_variable_list_update = function (data) {
	const self = this

	if (data) {
		self.custom_variables = data
	} else {
		self.system.emit('custom_variables_get', (d) => {
			self.custom_variables = d
		})
	}

	self.update_variables()

	self.init_actions()
}



// When module gets deleted
instance.prototype.destroy = function () {
	let self = this
	self.removeAllSystemCallbacks()
}

instance.prototype.init_actions = function () {
	let self = this
//self.debug('init actions')	
	self.FIELD_JSON_DATA_VARIABLE = {
		type: 'dropdown',
		label: 'JSON Result Data Variable',
		id: 'jsonResultDataVariable',
		default: '',
		choices: Object.entries(self.custom_variables).map(([id, info]) => ({
			id: id,
			label: id,
		})),
	}
	self.FIELD_JSON_DATA_VARIABLE.choices.unshift({ id: '', label: '<NONE>' })

	self.FIELD_JSON_PATH = {
		type: 'textwithvariables',
		label: 'Path (like $.age)',
		id: 'jsonPath',
		default: '',
	}

	self.FIELD_TARGET_VARIABLE = {
		type: 'dropdown',
		label: 'Target Variable',
		id: 'targetVariable',
		default: '',
		choices: Object.entries(self.custom_variables).map(([id, info]) => ({
			id: id,
			label: id,
		})),
	}
	self.FIELD_TARGET_VARIABLE.choices.unshift({ id: '', label: '<NONE>' })

	self.FIELD_CUSTOM_VARIABLE = {
		type: 'dropdown',
		label: 'Custom variable',
		id: 'name',
		default: Object.keys(self.custom_variables)[0],
		choices: Object.entries(self.custom_variables).map(([id, info]) => ({
			id: id,
			label: id,
		})),
	}

	actions = {
		custom_variable_set_value: {
			label: 'Set value',
			options: [
				self.FIELD_CUSTOM_VARIABLE,
				{
					type: 'textinput',
					label: 'Value',
					id: 'value',
					default: '',
				},
			],
		},
		custom_variable_set_expression: {
			label: 'Set expression',
			options: [
				self.FIELD_CUSTOM_VARIABLE,
				{
					type: 'textwithvariables',
					label: 'Expression',
					id: 'expression',
					default: '',
				},
			],
		},
		custom_variable_store_variable: {
			label: 'Set from another variable',
			options: [
				self.FIELD_CUSTOM_VARIABLE,
				{
					type: 'dropdown',
					id: 'variable',
					label: 'Variable to store value from',
					tooltip: 'What variable to store in the custom variable?',
					default: 'internal:time_hms',
					choices: self.CHOICES_VARIABLES,
				},
			],
		},
		custom_variable_set_via_jsonpath: {
			label: 'Set from a stored JSONresult via a JSONpath expression',
			options: [self.FIELD_JSON_DATA_VARIABLE, self.FIELD_JSON_PATH, self.FIELD_TARGET_VARIABLE],
		},
	}

	if (self.system.listenerCount('restart') > 0) {
		// Only offer app_restart if there is a handler for the event
		actions['app_restart'] = {
			label: 'Restart companion',
		}
	}

	self.system.emit('instance_actions', self.id, actions)
}

instance.prototype.action = function (action, extras) {
	let self = this
	let opt = action.options

	//TODO: consider moving this code to lib/variable.js, where the other custom-var code resides
self.debug('action')
	// extract value from the stored json response data, assign to target variable
	if (action.action === 'custom_variable_set_via_jsonpath') {
self.debug('jsonpath')		
		// get the json response data from the custom variable that holds the data
		let jsonResultData = ''
		let variableName = `custom_${action.options.jsonResultDataVariable}`
		self.system.emit('variable_get', 'internal', variableName, (value) => {
			jsonResultData = value
			self.debug('jsonResultData', jsonResultData)
		})

		// recreate a json object from stored json result data string
		let objJson = ''
		try {
			objJson = JSON.parse(jsonResultData)
		} catch (e) {
			self.log('error', `HTTP ${action.action.toUpperCase()} Cannot create JSON object, malformed JSON data (${e.message})`)
			return
		}

		// extract the value via the given standard JSONPath expression
		let valueToSet = ''
		try {
			valueToSet = jp.query(objJson, action.options.jsonPath)
		} catch (error) {
			self.log('error', `HTTP ${action.action.toUpperCase()} Cannot extract JSON value (${e.message})`)
			return
		}

		self.system.emit('custom_variable_set_value', action.options.targetVariable, valueToSet)

		return
	}

	if (action.action == 'custom_variable_set_value') {
		self.system.emit('custom_variable_set_value', opt.name, opt.value)
	}
	else if (action.action === 'custom_variable_set_expression') {
		self.system.emit('custom_variable_set_expression', opt.name, opt.expression)
	}
	else if (action.action == 'custom_variable_store_variable') {
		let value = ''
		const id = opt.variable.split(':')
		self.system.emit('variable_get', id[0], id[1], (v) => (value = v))
		self.system.emit('custom_variable_set_value', opt.name, value)
	}
}


instance.prototype.update_variables = function () {
	let self = this
	let variables = []

	for (const [name, info] of Object.entries(self.custom_variables)) {
		variables.push({
			label: info.description,
			name: `custom_${name}`,
		})
	}

	self.setVariableDefinitions(variables)

}

instance_skel.extendedBy(instance)
exports = module.exports = instance
