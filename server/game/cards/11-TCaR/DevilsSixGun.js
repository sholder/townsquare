const GoodsCard = require('../../goodscard.js');
const GameActions = require('../../GameActions/index.js');

class DevilsSixGun extends GoodsCard {
    setupCardAbilities(ability) {
        this.whileAttached({
            effect: ability.effects.setAsStud(this.uuid)
        });
        this.action({
            title: 'Devil\'s Six Gun',
            cost: ability.costs.bootSelf(),
            playType: 'cheatin resolution',
            handler: context => {
                this.game.resolveGameAction(
                    GameActions.search({
                        title: 'Select a Joker',
                        match: { condition: card => card.getType() === 'joker', location: ['draw deck', 'discard pile', 'dead pile'] },
                        numToSelect: 1,
                        message: {
                            format: '{player} uses {source} to search for {searchTarget} and puts it into their draw hand'
                        },
                        cancelMessage: {
                            format: '{player} uses {source} to search their draw deck, discard pile and Boot Hill, but does not find a Joker'
                        },
                        handler: jokerCard => {
                            context.player.moveCard(jokerCard, 'draw hand');
                            this.game.promptForSelect(context.player, {
                                activePromptTitle: 'Select a card from your draw hand to discard',
                                waitingPromptTitle: 'Waiting for opponent to discard a card from their draw hand',
                                cardCondition: { location: 'draw hand' },
                                onSelect: (player, cardToDiscard) => {
                                    this.game.resolveGameAction(GameActions.discardCard({card: cardToDiscard}), context).thenExecute(() => {
                                        /* Reset hand rank modifiers since we're making a new hand to check */
                                        player.rankModifier = 0;
                                        player.determineHandResult();
                                        this.game.addMessage('{0} uses {1} to discard a card from their draw hand. Their hand rank is now {2}', player, this, player.getTotalRank());
                                    });
                                    return true;
                                }                   
                            });
                            this.game.before('onDrawHandDiscarded', event => {
                                event.player.moveCard(jokerCard, 'draw deck');
                                event.player.shuffleDrawDeck();
                                this.game.addMessage('{0} shuffles {1} back to the draw deck thanks to {2}', event.player, jokerCard, this);
                            }, true, event => event.player === context.player);
                        }
                    }), {
                        game: this.game,
                        player: context.player,
                        source: this
                    }
                );
            }
        });
    }
}

DevilsSixGun.code = '19029';

module.exports = DevilsSixGun;