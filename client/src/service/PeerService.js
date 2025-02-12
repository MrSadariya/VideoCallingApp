class PeerService{
    constructor(){
        
        if(!this.peer){
            this.peer=new RTCPeerConnection({
                iceServers:[
                    {
                        urls:['stun:stun.l.google.com:19302',
                            'stun:global.stun.twilio.com:3478'
                        ]
                    }
                ]
            })
        }
    }

    async createOfferSdp(){
        if(this.peer){
            const offer=await this.peer.createOffer();
            await this.peer.setLocalDescription(new RTCSessionDescription(offer));
            return offer;
        }
    }

    async createAnswerSdp(offer){
        if(this.peer){
            await this.peer.setRemoteDescription(new RTCSessionDescription(offer));
            const ans=await this.peer.createAnswer();
            await this.peer.setLocalDescription(new RTCSessionDescription(ans));
            return ans;
        }
    }

    async setAnswerAsRemote(ans){
        if(this.peer){
            await this.peer.setRemoteDescription(new RTCSessionDescription(ans));
        }
    }


}

export default new PeerService();