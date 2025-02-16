const DrawCard = require('./drawcard.js');

const AllowedConditionTypes = ['adjacent', 'prevent'];

class LocationCard extends DrawCard {
    constructor(owner, cardData) {
        super(owner, cardData);
        this.gameLocationObject = null;
        this.defaultAdjacencyEffects = [];
    }

    getGameLocation() {
        return this.gameLocationObject;
    }

    leavesPlay() {
        super.leavesPlay();
        this.gameLocationObject = null;
    }

    receiveProduction(player) {
        if(player === this.owner || this.productionToBeReceivedBy === player) {
            return this.production;
        }
        return 0;
    }

    addAdjacencyLocation(location, source, type) {
        if(!AllowedConditionTypes.includes(type)) {
            return;
        }
        // gameLocationObject is null if deed was not yet placed in the 'play area'.
        // That is why we just put the adjacency effect to the array and the GameLocation
        // will be updated once it is created for this LocationCard.
        // Note: Order is important!
        if(!this.gameLocationObject) {
            this.defaultAdjacencyEffects.push({ location, source, type });
        } else {
            this.gameLocationObject.addAdjacency(location, source, type);
        }
    }

    removeAdjacencyLocation(location, source, type) {
        if(!AllowedConditionTypes.includes(type)) {
            return;
        }
        if(!this.gameLocationObject) {
            this.defaultAdjacencyEffects = this.defaultAdjacencyEffects.filter(adjEffect => adjEffect.location === location &&
                adjEffect.source === source && adjEffect.type === type);
        } else {
            this.gameLocationObject.removeAdjacency(location, source, type);
        }
    }

    addAdjacencyLocations(locations, source, type) {
        if(!AllowedConditionTypes.includes(type)) {
            return;
        }
        locations.forEach(affectedLocation => this.addAdjacencyLocation(affectedLocation, source, type));
    }

    removeAdjacency(location, source, type) {
        if(!AllowedConditionTypes.includes(type)) {
            return;
        }
        this.gameLocationObject.removeAdjacency(location, source, type);
    }

    removeAdjacencyLocations(locations, source, type) {
        if(!AllowedConditionTypes.includes(type)) {
            return;
        }
        locations.forEach(affectedLocation => this.removeAdjacencyLocation(affectedLocation, source, type));
    }

    adjacentLocations() {
        if(!this.gameLocationObject) {
            return [];
        }
        let adjacentLocations = this.game.filterCardsInPlay(card => card.isLocationCard() && this.isAdjacent(card.uuid)).
            map(card => card.getGameLocation());
        if(this.isAdjacent(this.game.townsquare.uuid)) {
            adjacentLocations.concat(this.game.townsquare);
        }
        return adjacentLocations;
    }

    addKeyword(keyword) {
        super.addKeyword(keyword);
        if(keyword === 'rowdy') {
            this.controlDeterminator = 'bullets';
        }
    }

    removeKeyword(keyword) {
        super.removeKeyword(keyword);
        if(!this.hasKeyword('rowdy')) {
            this.controlDeterminator = 'influence:deed';
        }
    }

    isLocationCard() {
        return true;
    }
}

module.exports = LocationCard;
