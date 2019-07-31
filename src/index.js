import arrayToObject from './lib/array-to-object';

function normalizeNamespace(fn) {
  return (...params) => {
    // eslint-disable-next-line prefer-const
    let [namespace, map, getterType, actionType, mutationType] =
      typeof params[0] === `string` ? [...params] : [``, ...params];

    if (namespace.length && namespace.charAt(namespace.length - 1) !== `/`) {
      namespace += `/`;
    }

    getterType = `${namespace}${getterType || `getField`}`;
    actionType = `${namespace}${actionType || `saveField`}`;
    mutationType = `${namespace}${mutationType || `updateField`}`;

    return fn(namespace, map, getterType, actionType, mutationType);
  };
}

export function getField(state) {
  return path => path.split(/[.[\]]+/).reduce((prev, key) => prev[key], state);
}

export function updateField(state, { path, value }) {
  path.split(/[.[\]]+/).reduce((prev, key, index, array) => {
    if (array.length === index + 1) {
      // eslint-disable-next-line no-param-reassign
      prev[key] = value;
    }

    return prev[key];
  }, state);
}

export const mapFields = normalizeNamespace((namespace, fields, getterType, actionType, mutationType) => {
  const fieldsObject = Array.isArray(fields) ? arrayToObject(fields) : fields;

  return Object.keys(fieldsObject).reduce((prev, key) => {
    const path = fieldsObject[key];
    const field = {
      get() {
        return this.$store.getters[getterType](path);
      },
      set(value) {
        if (actionType) {
          this.$store.actions[actionType]({ path, value });
        } else {
          this.$store.commit(mutationType, { path, value });
        }
      },
    };
    // eslint-disable-next-line no-param-reassign
    prev[key] = field;

    return prev;
  }, {});
});

export const mapMultiRowFields = normalizeNamespace((
  namespace,
  paths,
  getterType,
  mutationType,
  actionType,
) => {
  const pathsObject = Array.isArray(paths) ? arrayToObject(paths) : paths;

  return Object.keys(pathsObject).reduce((entries, key) => {
    const path = pathsObject[key];

    // eslint-disable-next-line no-param-reassign
    entries[key] = {
      get() {
        const store = this.$store;
        const rows = store.getters[getterType](path);

        return rows.map((fieldsObject, index) =>
          Object.keys(fieldsObject).reduce((prev, fieldKey) => {
            const fieldPath = `${path}[${index}].${fieldKey}`;

            return Object.defineProperty(prev, fieldKey, {
              get() {
                return store.getters[getterType](fieldPath);
              },
              set(value) {
                // Added an actionType for vuex modules that prefer to call an action with api async functionality and then handle vuex store in own mutations
                if (actionType) {
                  store.actions[actionType]({fieldPath, value});
                } else {
                  store.commit(mutationType, { path: fieldPath, value });
                }
              },
            });
          }, {}));
      },
    };

    return entries;
  }, {});
});

export const createHelpers = ({ getterType, actionType, mutationType }) => ({
  [getterType]: getField,
  [mutationType]: updateField,
  [actionType]: actionType,
  mapFields: normalizeNamespace((namespace, fields) =>
    mapFields(namespace, fields, getterType, actionType, mutationType)),
  mapMultiRowFields: normalizeNamespace((namespace, paths) =>
    mapMultiRowFields(namespace, paths, getterType, actionType, mutationType)),
});
