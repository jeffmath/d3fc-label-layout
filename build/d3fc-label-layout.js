(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-array'), require('d3-selection'), require('d3-scale')) :
  typeof define === 'function' && define.amd ? define(['exports', 'd3-array', 'd3-selection', 'd3-scale'], factory) :
  (factory((global.fc = global.fc || {}),global.d3,global.d3,global.d3));
}(this, (function (exports,d3Array,d3Selection,d3Scale) { 'use strict';

var functor = (function (d) {
  return typeof d === 'function' ? d : function () {
    return d;
  };
});

// "Caution: avoid interpolating to or from the number zero when the interpolator is used to generate
// a string (such as with attr).
// Very small values, when stringified, may be converted to scientific notation and
// cause a temporarily invalid attribute or style property value.
// For example, the number 0.0000001 is converted to the string "1e-7".
// This is particularly noticeable when interpolating opacity values.
// To avoid scientific notation, start or end the transition at 1e-6,
// which is the smallest value that is not stringified in exponential notation."
// - https://github.com/mbostock/d3/wiki/Transitions#d3_interpolateNumber
var effectivelyZero = 1e-6;

// Wrapper around d3's selectAll/data data-join, which allows decoration of the result.
// This is achieved by appending the element to the enter selection before exposing it.
// A default transition of fade in/out is also implicitly added but can be modified.
var dataJoinUtil = (function (element, className) {
    element = element || 'g';

    var key = function key(_, i) {
        return i;
    };
    var explicitTransition = null;

    var dataJoin = function dataJoin(container, data) {
        data = data || function (d) {
            return d;
        };

        var implicitTransition = container.selection ? container : null;
        if (implicitTransition) {
            container = container.selection();
        }

        var selected = container.selectAll(function (d, i, nodes) {
            return Array.from(nodes[i].childNodes).filter(function (node) {
                return node.nodeType === 1;
            });
        }).filter(className == null ? element : element + '.' + className);
        var update = selected.data(data, key);

        var enter = update.enter().append(element).attr('class', className);

        var exit = update.exit();

        // automatically merge in the enter selection
        update = update.merge(enter);

        // if transitions are enabled apply a default fade in/out transition
        var transition = implicitTransition || explicitTransition;
        if (transition) {
            update = update.transition(transition).style('opacity', 1);
            enter.style('opacity', effectivelyZero);
            exit = exit.transition(transition).style('opacity', effectivelyZero);
        }

        exit.remove();

        update.enter = function () {
            return enter;
        };
        update.exit = function () {
            return exit;
        };

        return update;
    };

    dataJoin.element = function () {
        if (!arguments.length) {
            return element;
        }
        element = arguments.length <= 0 ? undefined : arguments[0];
        return dataJoin;
    };
    dataJoin.className = function () {
        if (!arguments.length) {
            return className;
        }
        className = arguments.length <= 0 ? undefined : arguments[0];
        return dataJoin;
    };
    dataJoin.key = function () {
        if (!arguments.length) {
            return key;
        }
        key = arguments.length <= 0 ? undefined : arguments[0];
        return dataJoin;
    };
    dataJoin.transition = function () {
        if (!arguments.length) {
            return explicitTransition;
        }
        explicitTransition = arguments.length <= 0 ? undefined : arguments[0];
        return dataJoin;
    };

    return dataJoin;
});

var createReboundMethod = (function (target, source, name) {
    var method = source[name];
    if (typeof method !== 'function') {
        throw new Error('Attempt to rebind ' + name + ' which isn\'t a function on the source object');
    }
    return function () {
        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
        }

        var value = method.apply(source, args);
        return value === source ? target : value;
    };
});

var createTransform = function createTransform(transforms) {
    return function (name) {
        return transforms.reduce(function (name, fn) {
            return name && fn(name);
        }, name);
    };
};

var rebindAll = (function (target, source) {
    for (var _len = arguments.length, transforms = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        transforms[_key - 2] = arguments[_key];
    }

    var transform = createTransform(transforms);
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = Object.keys(source)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var name = _step.value;

            var result = transform(name);
            if (result) {
                target[result] = createReboundMethod(target, source, name);
            }
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    return target;
});

var regexify = (function (strsOrRegexes) {
    return strsOrRegexes.map(function (strOrRegex) {
        return typeof strOrRegex === 'string' ? new RegExp('^' + strOrRegex + '$') : strOrRegex;
    });
});

var include = (function () {
    for (var _len = arguments.length, inclusions = Array(_len), _key = 0; _key < _len; _key++) {
        inclusions[_key] = arguments[_key];
    }

    inclusions = regexify(inclusions);
    return function (name) {
        return inclusions.some(function (inclusion) {
            return inclusion.test(name);
        }) && name;
    };
});

var label = (function (layoutStrategy) {

    var decorate = function decorate() {};
    var size = function size() {
        return [0, 0];
    };
    var position = function position(d, i) {
        return [d.x, d.y];
    };
    var strategy = layoutStrategy || function (x) {
        return x;
    };
    var component = function component() {};
    var xScale = d3Scale.scaleIdentity();
    var yScale = d3Scale.scaleIdentity();

    var dataJoin$$1 = dataJoinUtil('g', 'label');

    var label = function label(selection) {

        selection.each(function (data, index, group) {

            var g = dataJoin$$1(d3Selection.select(group[index]), data).call(component);

            // obtain the rectangular bounding boxes for each child
            var nodes = g.nodes();
            var childRects = nodes.map(function (node, i) {
                var d = d3Selection.select(node).datum();
                var pos = position(d, i, nodes);
                var childPos = [xScale(pos[0]), yScale(pos[1])];
                var childSize = size(d, i, nodes);
                return {
                    hidden: false,
                    x: childPos[0],
                    y: childPos[1],
                    width: childSize[0],
                    height: childSize[1],
                    populationRank: d.populationRank
                };
            });

            // apply the strategy to derive the layout. The strategy does not change the order
            // or number of label.
            var layout = strategy(childRects);

            g.attr('style', function (_, i) {
                return 'display:' + (layout[i].hidden ? 'none' : 'inherit');
            }).attr('transform', function (_, i) {
                return 'translate(' + layout[i].x + ', ' + layout[i].y + ')';
            })
            // set the layout width / height so that children can use SVG layout if required
            .attr('layout-width', function (_, i) {
                return layout[i].width;
            }).attr('layout-height', function (_, i) {
                return layout[i].height;
            }).attr('anchor-x', function (d, i, g) {
                return childRects[i].x - layout[i].x;
            }).attr('anchor-y', function (d, i, g) {
                return childRects[i].y - layout[i].y;
            });

            g.call(component);

            decorate(g, data, index);
        });
    };

    rebindAll(label, dataJoin$$1, include('key'));
    rebindAll(label, strategy);

    label.size = function () {
        if (!arguments.length) {
            return size;
        }
        size = functor(arguments.length <= 0 ? undefined : arguments[0]);
        return label;
    };

    label.position = function () {
        if (!arguments.length) {
            return position;
        }
        position = functor(arguments.length <= 0 ? undefined : arguments[0]);
        return label;
    };

    label.component = function () {
        if (!arguments.length) {
            return component;
        }
        component = arguments.length <= 0 ? undefined : arguments[0];
        return label;
    };

    label.decorate = function () {
        if (!arguments.length) {
            return decorate;
        }
        decorate = arguments.length <= 0 ? undefined : arguments[0];
        return label;
    };

    label.xScale = function () {
        if (!arguments.length) {
            return xScale;
        }
        xScale = arguments.length <= 0 ? undefined : arguments[0];
        return label;
    };

    label.yScale = function () {
        if (!arguments.length) {
            return yScale;
        }
        yScale = arguments.length <= 0 ? undefined : arguments[0];
        return label;
    };

    return label;
});

var textLabel = (function (layoutStrategy) {

    var padding = 2;
    var value = function value(x) {
        return x;
    };

    var textJoin = dataJoinUtil('text');
    var rectJoin = dataJoinUtil('rect');
    var pointJoin = dataJoinUtil('circle');

    var textLabel = function textLabel(selection) {
        selection.each(function (data, index, group) {

            var node = group[index];
            var nodeSelection = d3Selection.select(node);

            var width = Number(node.getAttribute('layout-width'));
            var height = Number(node.getAttribute('layout-height'));
            var rect = rectJoin(nodeSelection, [data]);
            rect.attr('width', width).attr('height', height);

            var anchorX = Number(node.getAttribute('anchor-x'));
            var anchorY = Number(node.getAttribute('anchor-y'));
            var circle = pointJoin(nodeSelection, [data]);
            circle.attr('r', 2).attr('cx', anchorX).attr('cy', anchorY);

            var text = textJoin(nodeSelection, [data]);
            text.enter().attr('dy', '0.9em').attr('transform', 'translate(' + padding + ', ' + padding + ')');
            text.text(value);
        });
    };

    textLabel.padding = function () {
        if (!arguments.length) {
            return padding;
        }
        padding = arguments.length <= 0 ? undefined : arguments[0];
        return textLabel;
    };

    textLabel.value = function () {
        if (!arguments.length) {
            return value;
        }
        value = functor(arguments.length <= 0 ? undefined : arguments[0]);
        return textLabel;
    };

    return textLabel;
});

var isIntersecting = function isIntersecting(a, b) {
    return !(a.x >= b.x + b.width || a.x + a.width <= b.x || a.y >= b.y + b.height || a.y + a.height <= b.y);
};

var intersect = (function (a, b) {
    if (isIntersecting(a, b)) {
        var left = Math.max(a.x, b.x);
        var right = Math.min(a.x + a.width, b.x + b.width);
        var top = Math.max(a.y, b.y);
        var bottom = Math.min(a.y + a.height, b.y + b.height);
        return (right - left) * (bottom - top);
    } else {
        return 0;
    }
});

// computes the area of overlap between the rectangle with the given index with the
// rectangles in the array
var collisionArea = function collisionArea(rectangles, index) {
    return d3Array.sum(rectangles.map(function (d, i) {
        return index === i ? 0 : intersect(rectangles[index], d);
    }));
};

// computes the total overlapping area of all of the rectangles in the given array

var getPlacement = function getPlacement(x, y, width, height, location) {
    return {
        x: x,
        y: y,
        width: width,
        height: height,
        location: location
    };
};

// returns all the potential placements of the given label
var placements = (function (label) {
    var x = label.x;
    var y = label.y;
    var width = label.width;
    var height = label.height;
    return [getPlacement(x, y, width, height, 'bottom-right'), getPlacement(x - width, y, width, height, 'bottom-left'), getPlacement(x - width, y - height, width, height, 'top-left'), getPlacement(x, y - height, width, height, 'top-right'), getPlacement(x, y - height / 2, width, height, 'middle-right'), getPlacement(x - width / 2, y, width, height, 'bottom-center'), getPlacement(x - width, y - height / 2, width, height, 'middle-left'), getPlacement(x - width / 2, y - height, width, height, 'top-center')].map(function (p) {
        return Object.assign(p, { populationRank: label.populationRank });
    });
});

var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};

var substitute = function substitute(array, index, substitution) {
    return [].concat(toConsumableArray(array.slice(0, index)), [substitution], toConsumableArray(array.slice(index + 1)));
};

var lessThan = function lessThan(a, b) {
    return a < b;
};

// a layout takes an array of rectangles and allows their locations to be optimised.
// it is constructed using two functions, locationScore, which score the placement of and
// individual rectangle, and winningScore which takes the scores for a rectangle
// at two different locations and assigns a winningScore.
var layoutComponent = function layoutComponent() {
    var score = null;

    var winningScore = lessThan;

    var locationScore = function locationScore() {
        return 0;
    };

    var rectangles = void 0;

    var evaluatePlacement = function evaluatePlacement(placement, index) {
        return score - locationScore(rectangles[index], index, rectangles) + locationScore(placement, index, substitute(rectangles, index, placement));
    };

    var layout = function layout(placement, index) {
        if (!score) {
            score = d3Array.sum(rectangles.map(function (r, i) {
                return locationScore(r, i, rectangles);
            }));
        }

        var newScore = evaluatePlacement(placement, index);

        if (winningScore(newScore, score)) {
            return layoutComponent().locationScore(locationScore).winningScore(winningScore).score(newScore).rectangles(substitute(rectangles, index, placement));
        } else {
            return layout;
        }
    };

    layout.rectangles = function () {
        if (!arguments.length) {
            return rectangles;
        }
        rectangles = arguments.length <= 0 ? undefined : arguments[0];
        return layout;
    };
    layout.score = function () {
        if (!arguments.length) {
            return score;
        }
        score = arguments.length <= 0 ? undefined : arguments[0];
        return layout;
    };
    layout.winningScore = function () {
        if (!arguments.length) {
            return winningScore;
        }
        winningScore = arguments.length <= 0 ? undefined : arguments[0];
        return layout;
    };
    layout.locationScore = function () {
        if (!arguments.length) {
            return locationScore;
        }
        locationScore = arguments.length <= 0 ? undefined : arguments[0];
        return layout;
    };

    return layout;
};

var greedy = (function () {

    var bounds = void 0;

    var containerPenalty = function containerPenalty(rectangle) {
        return bounds ? rectangle.width * rectangle.height - intersect(rectangle, bounds) : 0;
    };

    var penaltyForRectangle = function penaltyForRectangle(rectangle, index, rectangles) {
        return collisionArea(rectangles, index) + containerPenalty(rectangle);
    };

    var strategy = function strategy(data) {
        var rectangles = layoutComponent().locationScore(penaltyForRectangle).rectangles(data);

        data.forEach(function (rectangle, index) {
            placements(rectangle).forEach(function (placement, placementIndex) {
                rectangles = rectangles(placement, index);
            });
        });
        return rectangles.rectangles();
    };

    strategy.bounds = function () {
        if (!arguments.length) {
            return bounds;
        }
        bounds = arguments.length <= 0 ? undefined : arguments[0];
        return strategy;
    };

    return strategy;
});

var randomItem = function randomItem(array) {
    return array[randomIndex(array)];
};

var randomIndex = function randomIndex(array) {
    return Math.floor(Math.random() * array.length);
};

var annealing = (function () {

    var temperature = 1000;
    var cooling = 1;
    var bounds = void 0;

    var orientationPenalty = function orientationPenalty(rectangle) {
        switch (rectangle.location) {
            case 'bottom-right':
                return 0;
            case 'middle-right':
            case 'bottom-center':
                return rectangle.width * rectangle.height / 8;
        }
        return rectangle.width * rectangle.height / 4;
    };

    var containerPenalty = function containerPenalty(rectangle) {
        return bounds ? rectangle.width * rectangle.height - intersect(rectangle, bounds) : 0;
    };

    var penaltyForRectangle = function penaltyForRectangle(rectangle, index, rectangles) {
        return collisionArea(rectangles, index) + containerPenalty(rectangle) + orientationPenalty(rectangle);
    };

    var strategy = function strategy(data) {
        var currentTemperature = temperature;

        // use annealing to allow a new score to be picked even if it is worse than the old
        var winningScore = function winningScore(newScore, oldScore) {
            return Math.exp((oldScore - newScore) / currentTemperature) > Math.random();
        };

        var rectangles = layoutComponent().locationScore(penaltyForRectangle).winningScore(winningScore).rectangles(data);

        while (currentTemperature > 0) {
            var index = randomIndex(data);
            var randomNewPlacement = randomItem(placements(data[index]));
            rectangles = rectangles(randomNewPlacement, index);
            currentTemperature -= cooling;
        }
        return rectangles.rectangles();
    };

    strategy.temperature = function () {
        if (!arguments.length) {
            return temperature;
        }
        temperature = arguments.length <= 0 ? undefined : arguments[0];
        return strategy;
    };

    strategy.cooling = function () {
        if (!arguments.length) {
            return cooling;
        }
        cooling = arguments.length <= 0 ? undefined : arguments[0];
        return strategy;
    };

    strategy.bounds = function () {
        if (!arguments.length) {
            return bounds;
        }
        bounds = arguments.length <= 0 ? undefined : arguments[0];
        return strategy;
    };

    return strategy;
});

var scanForObject = function scanForObject(array, comparator) {
    return array[d3Array.scan(array, comparator)];
};

var removeOverlaps = (function (adaptedStrategy) {

    adaptedStrategy = adaptedStrategy || function (x) {
        return x;
    };

    var removeOverlaps = function removeOverlaps(layout) {
        layout = adaptedStrategy(layout);

        var _loop = function _loop() {
            // find the collision area for all overlapping rectangles, hiding the one
            // with the highest population rank
            var visible = layout.filter(function (d) {
                return !d.hidden;
            });
            var collisions = visible.map(function (d, i) {
                return [d, collisionArea(visible, i)];
            }).filter(function (d) {
                return d[1] > 0;
            });
            if (!collisions.length) return 'break';
            var collision = scanForObject(collisions, function (a, b) {
                return b[0].populationRank - a[0].populationRank;
            });
            collision[0].hidden = true;
        };

        while (true) {
            var _ret = _loop();

            if (_ret === 'break') break;
        }
        return layout;
    };

    rebindAll(removeOverlaps, adaptedStrategy);

    return removeOverlaps;
});

var boundingBox = (function () {

    var bounds = [0, 0];

    var strategy = function strategy(data) {
        return data.map(function (d, i) {
            var tx = d.x;
            var ty = d.y;
            if (tx + d.width > bounds[0]) {
                tx -= d.width;
            }

            if (ty + d.height > bounds[1]) {
                ty -= d.height;
            }
            return { height: d.height, width: d.width, x: tx, y: ty };
        });
    };

    strategy.bounds = function () {
        if (!arguments.length) {
            return bounds;
        }
        bounds = arguments.length <= 0 ? undefined : arguments[0];
        return strategy;
    };

    return strategy;
});

exports.layoutLabel = label;
exports.layoutTextLabel = textLabel;
exports.layoutGreedy = greedy;
exports.layoutAnnealing = annealing;
exports.layoutRemoveOverlaps = removeOverlaps;
exports.layoutBoundingBox = boundingBox;

Object.defineProperty(exports, '__esModule', { value: true });

})));
