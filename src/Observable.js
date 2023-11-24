export class Observable {
    _observed
    _listeners = new Set()
    
    constructor(v) {
        this._observed = v
    }

    set(v) {
        const old = this._observed
        if(v === old) return
        this._observed = v
        this._listeners.forEach(fn => fn(v, old))
    }

    get() {
        return this._observed
    }

    subscribe(fn) {
        if (typeof fn !== 'function') throw new Error('`fn` parameter must be a function')
        fn(this._observed, this._observed)
        this._listeners.add(fn)
        return () => this.unsubscribe(fn)
    }

    unsubscribe(fn) {
        return this._listeners.delete(fn)
    }
}

export class Computed {
    
    _observable
    _timeoutId
    
    constructor(compute, dependencies) {
        this._observable = new Observable(compute())
        dependencies.forEach(observable => {
            if(
                !(observable instanceof Observable)
                && !(observable instanceof Computed)
            ) throw new Error('`dependencies` must be an array of Observable and Computed')
            observable.subscribe(() => {
                clearTimeout(this._timeoutId)
                this._timeoutId = setTimeout(() => this._observable.set(compute()), 0)
            })
        })
    }

    get() {
        return this._observable.get()
    }

    subscribe(fn) {
        return this._observable.subscribe(fn)
    }

    unsubscribe(fn) {
        return this._observable.subscribe(fn)
    }
}

/**
 * 
 * @param {*} v observed initial value
 * @returns {Observable}
 */
export function observable(v) {
    return new Observable(v)
}

/**
 * 
 * @param {Observable} observable 
 * @returns {Computed} readonly version of the Observable
 */
export function readonly(observable) {
    return new Computed(() => observable.get(), [observable])
}