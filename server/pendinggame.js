const uuid = require('uuid');
const _ = require('underscore');
const crypto = require('crypto');

const logger = require('./log.js');
const GameChat = require('./game/gamechat.js');

class PendingGame {
    constructor(owner, details) {
        this.owner = owner;
        this.players = {};
        this.spectators = {};
        this.id = uuid.v1();
        this.name = details.name;
        this.event = details.event || { _id: 'none' };
        this.restrictedList = details.restrictedList;
        this.allowSpectators = details.spectators;
        this.showHand = details.showHand;
        this.gameType = details.gameType;
        this.isMelee = details.isMelee;
        this.useRookery = details.useRookery;
        this.createdAt = new Date();
        this.gameChat = new GameChat();
        this.useGameTimeLimit = details.useGameTimeLimit;
        this.gameTimeLimit = details.gameTimeLimit;
    }

    // Getters
    getPlayersAndSpectators() {
        return Object.assign({}, this.players, this.spectators);
    }

    getPlayers() {
        return this.players;
    }

    getSpectators() {
        return Object.values(this.spectators);
    }

    getPlayerOrSpectator(playerName) {
        return this.getPlayersAndSpectators()[playerName];
    }

    getPlayerByName(playerName) {
        return this.players[playerName];
    }

    getSaveState() {
        var players = _.map(this.getPlayers(), player => {
            return {
                legend: player.legend ? player.legend.cardData.title : undefined,
                outfit: player.outfit.cardData.title,
                name: player.name
            };
        });

        return {
            gameId: this.id,
            gameType: this.gameType,
            players: players,
            startedAt: this.createdAt
        };
    }

    // Helpers
    setupOutfit(player, outfit) {
        player.outfit = {};
        player.outfit.cardData = outfit;
        player.outfit.cardData.code = outfit.code;
        player.outfit.cardData.type_code = 'outfit';
    }

    setupLegend(player, legend) {
        if(!legend) {
            return;
        }

        player.legend = {};
        player.legend.cardData = legend;
    }

    // Actions
    addMessage() {
        this.gameChat.addMessage(...arguments);
    }

    addPlayer(id, user) {
        if(!user) {
            logger.error('Tried to add a player to a game that did not have a user object');
            return;
        }

        this.players[user.username] = {
            id: id,
            name: user.username,
            user: user,
            owner: this.owner.username === user.username
        };
    }

    addSpectator(id, user) {
        this.spectators[user.username] = {
            id: id,
            name: user.username,
            user: user
        };
    }

    newGame(id, user, password) {
        if(password) {
            this.password = crypto.createHash('md5').update(password).digest('hex');
        }

        this.addPlayer(id, user);
    }

    isUserBlocked(user) {
        return _.contains(this.owner.blockList, user.username.toLowerCase());
    }

    join(id, user, password) {
        if(_.size(this.players) === 2 || this.started) {
            return;
        }

        if(this.isUserBlocked(user)) {
            return;
        }

        if(this.password) {
            if(crypto.createHash('md5').update(password).digest('hex') !== this.password) {
                return 'Incorrect game password';
            }
        }

        this.addPlayer(id, user);
        this.addMessage('{0} has joined the game', user.username);
    }

    watch(id, user, password, callback) {
        if(!this.allowSpectators) {
            callback(new Error('Join not permitted'));

            return;
        }

        if(this.isUserBlocked(user)) {
            return;
        }

        if(this.password) {
            if(crypto.createHash('md5').update(password).digest('hex') !== this.password) {
                return 'Incorrect game password';
            }
        }

        this.addSpectator(id, user);
        this.addMessage('{0} has joined the game as a spectator', user.username);
    }

    leave(playerName) {
        var player = this.getPlayerOrSpectator(playerName);
        if(!player) {
            return;
        }

        if(!this.started) {
            this.addMessage('{0} has left the game', playerName);
        }

        if(this.players[playerName]) {
            if(this.started) {
                this.players[playerName].left = true;
            } else {
                this.removeAndResetOwner(playerName);

                delete this.players[playerName];
            }
        }

        if(this.spectators[playerName]) {
            delete this.spectators[playerName];
        }
    }

    disconnect(playerName) {
        var player = this.getPlayerOrSpectator(playerName);
        if(!player) {
            return;
        }

        if(!this.started) {
            this.addMessage('{0} has disconnected', playerName);
        }

        if(this.players[playerName]) {
            if(!this.started) {
                this.removeAndResetOwner(playerName);

                delete this.players[playerName];
            }
        } else {
            delete this.spectators[playerName];
        }
    }

    chat(playerName, message) {
        var player = this.getPlayerOrSpectator(playerName);
        if(!player) {
            return;
        }

        player.argType = 'player';

        this.addMessage('{0} {1}', player, message);
    }

    selectDeck(playerName, deck) {
        var player = this.getPlayerByName(playerName);
        if(!player) {
            return;
        }

        if(player.deck) {
            player.deck.selected = false;
        }

        player.deck = deck;
        player.deck.selected = true;

        this.setupOutfit(player, deck.outfit);
        this.setupLegend(player, deck.legend);
    }

    // interrogators
    isEmpty() {
        return !_.any(this.getPlayersAndSpectators(), player => this.hasActivePlayer(player.name));
    }

    isOwner(playerName) {
        var player = this.players[playerName];

        if(!player || !player.owner) {
            return false;
        }

        return true;
    }

    removeAndResetOwner(playerName) {
        if(this.isOwner(playerName)) {
            let otherPlayer = _.find(this.players, player => player.name !== playerName);
            if(otherPlayer) {
                this.owner = otherPlayer.user;
                otherPlayer.owner = true;
            }
        }
    }

    isVisibleFor(user) {
        if(!user) {
            return true;
        }

        let players = Object.values(this.players);
        return !this.owner.hasUserBlocked(user) && !user.hasUserBlocked(this.owner) && players.every(player => !player.user.hasUserBlocked(user));
    }

    hasActivePlayer(playerName) {
        return this.players[playerName] && !this.players[playerName].left && !this.players[playerName].disconnected || this.spectators[playerName];
    }

    // Summary
    getSummary(activePlayer) {
        var playerSummaries = {};
        var playersInGame = _.filter(this.players, player => !player.left);

        _.each(playersInGame, player => {
            var deck = undefined;

            if(activePlayer === player.name && player.deck) {
                deck = { name: player.deck.name, selected: player.deck.selected, status: player.deck.status };
            } else if(player.deck) {
                deck = { selected: player.deck.selected, status: player.deck.status };
            } else {
                deck = {};
            }

            playerSummaries[player.name] = {
                legend: this.started && player.legend ? player.legend.cardData.code : undefined,
                deck: activePlayer ? deck : {},
                outfit: this.started && player.outfit ? player.outfit.cardData.code : undefined,
                id: player.id,
                left: player.left,
                name: player.name,
                owner: player.owner,
                role: player.user.role,
                settings: player.user.settings
            };
        });

        return {
            allowSpectators: this.allowSpectators,
            createdAt: this.createdAt,
            gameType: this.gameType,
            event: this.event,
            id: this.id,
            messages: activePlayer ? this.gameChat.messages : undefined,
            name: this.name,
            needsPassword: !!this.password,
            node: this.node ? this.node.identity : undefined,
            owner: this.owner.username,
            players: playerSummaries,
            restrictedList: this.restrictedList,
            showHand: this.showHand,
            started: this.started,
            spectators: _.map(this.spectators, spectator => {
                return {
                    id: spectator.id,
                    name: spectator.name,
                    settings: spectator.settings
                };
            }),
            useGameTimeLimit: this.useGameTimeLimit,
            gameTimeLimit: this.gameTimeLimit
        };
    }

    getStartGameDetails() {
        const players = {};

        for(let playerDetails of Object.values(this.players)) {
            const {name, user, ...rest} = playerDetails;
            players[name] = {
                name,
                user: user.getDetails(),
                ...rest
            };
        }

        const spectators = {};
        for(let spectatorDetails of Object.values(this.spectators)) {
            const {name, user, ...rest} = spectatorDetails;
            spectators[name] = {
                name,
                user: user.getDetails(),
                ...rest
            };
        }

        return {
            allowSpectators: this.allowSpectators,
            createdAt: this.createdAt,
            event: this.event,
            gameType: this.gameType,
            id: this.id,
            name: this.name,
            owner: this.owner.getDetails(),
            players,
            restrictedList: this.restrictedList,
            showHand: this.showHand,
            spectators,
            useGameTimeLimit: this.useGameTimeLimit,
            gameTimeLimit: this.gameTimeLimit
        };
    }
}

module.exports = PendingGame;
