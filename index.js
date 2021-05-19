const Discord = require('discord.js');
const Client = new Discord.Client();

const {stripIndents} = require("common-tags");

// const express = require('express');
// const webApp = express();

const EMOJI = (name) => Client.emojis.cache.find(emoji => emoji.name === name);
const DELMSG = (msg) => setTimeout(()=>{msg.delete()}, 2000);

const serverSpecific = {
	"829744198529450054" : {
		botCommunicationChannel: ()=> Client.channels.cache.find(channel => channel.name == "bot-communication"),
		message: function(msg) {
			// console.log(msg);
			if(msg.hasOwnProperty('author')) {
				// if(msg.channel.parentID == "835298768587980810") {	//for testing
					const {content} = msg;
					const commandChain = content.match(/(?:[^\s"]+|"[^"]*")+/g);
					if(commandChain != null && commandChain[0][0] == '.') {
						// console.log(commandChain[0].slice(1), msg, commandChain.slice(1));
						callCommand(commandChain[0].slice(1), msg, commandChain.slice(1));
					}
				// }
			}else {
				console.error("error 1");
			}
		},
		commands: {
			auction: {
				desc: "拍賣，顧名思義",
				usage: ".auction \"角色名稱\" 拍賣時長(分鐘) 起拍價 [最小叫價漲幅]",
				func: function(msg, ...args) {
					// const serverID = msg.channel.guild.id;
					// const comChannel = serverSpecific[serverID].botCommunicationChannel();
					const nowDate = new Date();;
					if(args.length <= 2) {
						msg.channel.send(stripIndents`<@${msg.author.id}> 缺少參數，用法請看
							\`\`\`${this["commands"]["auction"]["usage"]}\`\`\`
						`);
						msg.react('❌');
						DELMSG(msg);
						return;
					}

					let minRaise = 1;
					const characterName = args[0].replace(/^"(.*)"$/, '$1').toLowerCase();

					if(args.length == 4) { // minBidRaise
						minRaise = 	args[3];
						let isRate = false;					
						if(minRaise.slice(-1) == '%') {
							isRate = true;
							minRaise = minRaise.slice(0, -1);
						}
						if(isNaN(minRaise)) {
							msg.channel.send(stripIndents`<@${msg.author.id}> 「最小叫價漲幅」應為合法的整數或百分比`);
							msg.react('❌');
							DELMSG(msg);
							return;
						}
						if(isRate)
							minRaise = Math.floor(minRaise * args[2] / 100);
					}

					if(nowAuctioned.hasOwnProperty(characterName)) {
						msg.channel.send(stripIndents`<@${msg.author.id}> 這個競標間已經存在了`);
						msg.react('❌');
						DELMSG(msg);
						return;
					}

					msg.react('✅');

					msg.channel.guild.channels.create(`競標間 ${characterName}`)
						.then(channel => {
							let category = msg.channel.guild.channels.cache.find(c => c.name == "特種貿易區" && c.type == "category");
							if (!category) throw new Error("Category channel does not exist");
							nowAuctioned[characterName] = {
								owner: msg.author.id,
								endTime: nowDate.getTime() + parseFloat(args[1])*60*1000,
								lastBidder: msg.author.id,
								lastBid: parseInt(args[2]) - minRaise,
								minRaise: minRaise,
								channel: channel
							};
							channel.setParent(category.id);
							channel.send(stripIndents`＊＊＊目前正在測試，請忽略這段訊息＊＊＊
								<@${msg.author.id}> 發起了對 「${characterName}」的競標，
								末五分鐘若出價則延長時限至該出價時間後五分鐘
								起拍價：　　　　${parseInt(args[2])}${EMOJI("Kakera")}
								最小叫價漲幅：　${minRaise}${EMOJI("Kakera")}
								時限：　　　　　${new Date(nowAuctioned[characterName]["endTime"])})}
							`);
							channel.updateOverwrite(channel.guild.roles["everyone"], { MANAGE_CHANNELS: false });
						}).catch(console.error);
					DELMSG(msg);
					return;
				}
			},
			bid: {
				desc: "出價",
				usage: ".bid 價格",
				func: (msg, ...args) => {
					for(let charName in nowAuctioned) {
						auctionObj = nowAuctioned[charName];
						if(auctionObj["channel"].id == msg.channel.id) {
							if(msg.author.id == auctionObj["owner"]) {
								msg.channel.send(stripIndents`<@${auctionObj["owner"]}> 還想自己抬價阿!`);
								msg.react('❌');
								DELMSG(msg);
								return;
							}else {
								const bid = args[0]/1;
								if(bid >= auctionObj["lastBid"]/1 + auctionObj["minRaise"]/1) {
									msg.react('✅');
									nowAuctioned[charName]["lastBidder"] = msg.author.id;
									nowAuctioned[charName]["lastBid"] = bid;
									msg.channel.send(stripIndents`<@${msg.author.id}> 出價：${bid}${EMOJI("Kakera")}`);
									DELMSG(msg);
									return;
								}else {
									console.log(bid,  auctionObj["lastBid"]/1 + auctionObj["minRaise"]/1, bid >= auctionObj["lastBid"]/1 + auctionObj["minRaise"]/1);
									msg.channel.send(stripIndents`<@${msg.author.id}> 未過出價最低漲幅`);
									msg.react('❌');
									DELMSG(msg);
									return;
								}
							}
						}
					}
					msg.channel.send(stripIndents`<@${msg.author.id}>，這裡不是個出價的地方`);
					msg.react('❌');
					DELMSG(msg);
					return;
				}
			},
			listAllEmojis: {
				desc: "測試用",
				usage: ".listAllEmjois",
				func: (msg, ...args) => {
					const emojiList = msg.guild.emojis.cache.map(emoji => emoji.toString()).join(" ");
  					msg.channel.send(emojiList);

				}
			},
			hello: {
				desc: "",
				usage:"",
				func: function(msg, ...args) {
					const serverID = msg.channel.guild.id;
					const comChannel = serverSpecific[serverID].botCommunicationChannel();
					comChannel.send("$pr");
				}
			}
		},
	}
};

let nowAuctioned = {

};

const checkAuction = (nowDate) => {
	for(let charName in nowAuctioned) {
		auctionObj = nowAuctioned[charName];
		channel = auctionObj["channel"];
		if(nowDate.getTime() >= auctionObj["endTime"]) {
			// console.log("inn");
			channel.updateOverwrite(channel.guild.roles["everyone"], { VIEW_CHANNEL: false });
			channel.updateOverwrite(channel.guild.members.cache.find(x => x.id == auctionObj["owner"]), { VIEW_CHANNEL: true });
			if(auctionObj["lastBidder"] != auctionObj["owner"]) {	// has been bidded
				channel.updateOverwrite(channel.guild.members.cache.find(x => x.id == auctionObj["lastBidder"]), { VIEW_CHANNEL: true });
				channel.send(stripIndents`－－－－結標－－－－
					${charName} 已由 <@${auctionObj["lastBidder"]}> 以 ${auctionObj["lastBid"]}${EMOJI("Kakera")} 得標
					已鎖定除得標者與標的物所有者以外之頻道可視權限
					請 <@${auctionObj["owner"]}> 盡快與 <@${auctionObj["lastBidder"]}> 交易
				`);
			}else {		// hasn't been bidded
				// console.log(channel);
				channel.send(stripIndents`－－－－流標－－－－
					已鎖定除標的物所有者以外之頻道可視權限
					<@${auctionObj["lastBidder"]}>，「${charName}」的起標價也許設的太高囉
				`);
			}
			delete nowAuctioned[charName];
		}
	}
}

let interval = setInterval(() => {
	const nowDate = new Date();
	callSpecific();
}, 10000);

Client.on('ready', async (e) => {
	console.log(`Logged in as ${Client.user.tag}!`);
});

const callSpecific = (eventName, serverID, rawArr) => {
	if(serverSpecific.hasOwnProperty(serverID))	// nesting to prevent key not found
		if(serverSpecific[serverID].hasOwnProperty(eventName)) {
			serverSpecific[serverID][eventName].apply(serverSpecific[serverID], rawArr);
			return true;
		}
	return false;
};

const callCommand = (commandName, pureMsg, args) => {
	const serverID = pureMsg.channel.guild.id;
	if(serverSpecific.hasOwnProperty(serverID) && serverSpecific[serverID].hasOwnProperty("commands"))	// nesting to prevent key not found
		if(serverSpecific[serverID]["commands"].hasOwnProperty(commandName)) {
			serverSpecific[serverID]["commands"][commandName]["func"].apply(serverSpecific[serverID], [pureMsg].concat(args));
			return true;
		}
	return false;
}

Client.on('message', (...raw) => {
	const serverID = raw[0].channel.guild.id;	//raw[0] => msg
	const isSpecific = callSpecific('message', serverID, raw);
	
	if(!isSpecific) {
		// not special
	}
});

Client.login(process.env.TOKEN);