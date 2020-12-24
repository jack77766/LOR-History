const express = require('express')
const app     = express()
const bp      = require('body-parser')
const fetch   = require('node-fetch');
const { match } = require('assert');
require('dotenv').config();
const API_KEY = process.env.API_KEY;
const { DeckEncoder } = require('runeterra');
// SETS ARE BEING CALLED DYNAMICALLY 
const set1 = require('./set1-lite-en_us/en_us/data/set1-en_us');
const set2 = require('./set2-lite-en_us/en_us/data/set2-en_us');
const set3 = require('./set3-lite-en_us/en_us/data/set3-en_us');



app.use('/', express.static(__dirname + '/public'));
app.use(bp.urlencoded({extended: true}));
app.set('view engine', 'ejs');


app.get('/', async (req,res) => {
  
    res.render('index');

})

app.post('/', async (req,res)=> {
    const user = req.body.username;
    const region = req.body.region;
    console.log(`In POST route, received username: ${user}, region: ${region}`);
    try {
        const PUUID       = await getUserPUUID(user,region);
        // const matchIDs    = await getMatchIDs(PUUID);
        const matchIDs = [ '4fca15db-84d5-4333-bb2c-863ceb863c24',
        '8e9e8394-daae-44c9-bb1c-69184236e528',
        '4609c1ea-e667-4a42-9151-821dbef65d8b'];
        console.log('In POST route, matchIDS:', matchIDs);

        const matches = await getMatches(matchIDs);
        matchesInfo = [];
        for(const match of matches) {
            const matchObject = await buildMatchObject(match);
            // console.log('MatchInfo: ', matchObject);
            matchesInfo.push(matchObject)
        }
        res.render('history', {matchesInfo: matchesInfo});
    }
    catch (err) {
        console.log(err);
        res.send(err.message);
    }

})

function getCard(cardCode, set) {
    try{
        for(const card of set) {
            if(card.cardCode == cardCode) {
                // console.log('we have a match')
                return card;
            }
        }
        throw {message: 'Card not found'}
    }
    catch(err) {
        console.log(`Error at getCard function`, err)
    }
}


function buildDeck(deckCode) {
    const deck = DeckEncoder.decode(deckCode);
    let returnDeck = [];
    for(let card of deck) {
        // console.log(`In buildDeck pushing card`, card);
        returnDeck.push(buildCard(card.code, card.count));
    }
    return returnDeck;
}

function buildCard(cardCode, count) {
    try{
        let set = cardCode.charAt(1);
        const card = getCard(cardCode, eval('set'+set));
        let returnCard = {};
        returnCard.imageUrl = card.assets[0].fullAbsolutePath;
        returnCard.region   = card.region;
        returnCard.name     = card.name;
        returnCard.count    = count;
        returnCard.tile     = `./public/LorTiles/${cardCode}.png`;
        returnCard.code     = cardCode;
        returnCard.type     = card.type;
        // console.log(`Returning card with name ${returnCard.name}, imagUrl ${returnCard.imageUrl}`)
        return returnCard;
    }
    catch(err) {
        // console.log(`In buildCard, returning empty card: `,err.message);
        return {}
    }
}

async function buildMatchObject(match) {
    const player1 = match.info.players[0];
    const player2 = match.info.players[1];
    const p1Deck = buildDeck(player1.deck_code);
    const p2Deck = buildDeck(player2.deck_code);
    const acc1 = await getAccount(player1.puuid);
    const acc2 = await getAccount(player2.puuid);
    const p1Faction = player1.factions.map(faction => faction.split('_')[1]);
    const p2Faction = player2.factions.map(faction => faction.split('_')[1]);
    let date = new Date(match.info.game_start_time_utc);
   

    const matchObject = {
        'gameType': match.info.game_type,
        'gameDate': date,
        'p1Name': acc1.gameName,
        'p2Name': acc2.gameName,
        'p1Region':  acc1.tagLine,
        'p2Region':  acc2.tagLine,
        'p1Factions':  p1Faction,
        'p2Factions':  p2Faction,
        'p1Outcome':  player1.game_outcome,
        'p2Outcome':  player2.game_outcome,
        'p1DeckCode': player1.deck_code,
        'p2DeckCode': player2.deck_code,
        'p1Deck': p1Deck,
        'p2Deck': p2Deck
    }
    return matchObject;
}
async function getAccount(PUUID) {
    const url = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-puuid/${PUUID}`;
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'X-Riot-Token': API_KEY
            }
        });
        return response.json();
    }
    catch(err) {
        console.log(err);
    }
}

async function getMatches(matchIDs) {
    let matches = [];
    for(const id of matchIDs) {
                    const match = await getMatchData(id);
                    console.log(`Pushing match`, match)
                    matches.push(match); 
    }
    // console.log(`Returning matches`)
    return matches;
}


async function getMatchData(matchID) {
    const url = `https://europe.api.riotgames.com/lor/match/v1/matches/${matchID}`;
    try {
        const response = await fetch(url, {
            headers: {
            'Content-Type': 'application/json',
            'X-Riot-Token': API_KEY
        }});
        return response.json();
    }
    catch(err) {
        console.log(err);
    }    
}

async function getMatchIDs(PUUID) {
    const url=`https://europe.api.riotgames.com/lor/match/v1/matches/by-puuid/${PUUID}/ids`;
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'X-Riot-Token': API_KEY
            }});
            const json = await response.json();
            // console.log(`In getMatchIDs, json:`, json);
            if(json.length == 0) throw {message: `Could not find matches for this account`}
            return json;
        }
        catch(err) {
            console.log(err);
            throw(err);
        }
    }
    
    async function getUserPUUID(user, region) {
        const url=`https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${user}/${region}`;
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Riot-Token': API_KEY
            }});
            const  json  = await response.json();
            // console.log(`in getUserPUUID returning`, json.puuid)  
            if(json.puuid === undefined) throw {message: `Could not find a match for user: ${user}, region: ${region}`};
            return json.puuid;
        }
        catch(err) {
            console.log("Error retrieving userPUUID", err);
            throw(err);
        }
    }

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server open on port ${PORT}`);
})