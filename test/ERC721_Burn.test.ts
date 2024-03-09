import {expect} from 'chai';
import {ethers, deployments, getUnnamedAccounts, getNamedAccounts} from 'hardhat';
import {ERC721_Burn} from '../typechain-types';
import {setupUser, setupUsers} from './utils';

const setup = deployments.createFixture(async () => {
	await deployments.fixture('ERC721_Burn');
	const {deployer, accountOne, accountTwo, accountThree} = await getNamedAccounts();
	const contracts = {
		ERC721_Burn: await ethers.getContract<ERC721_Burn>('ERC721_Burn'),
	};
	const users = await setupUsers(await getUnnamedAccounts(), contracts);
	return {
		...contracts,
		users,
		deployer: await setupUser(deployer, contracts),
		accountOne: await setupUser(accountOne, contracts),
		accountTwo: await setupUser(accountTwo, contracts),
		accountThree: await setupUser(accountThree, contracts),
	};
});

describe('ERC721_Burn', function () {
	it('tests deployment', async function () {
		const {ERC721_Burn} = await setup();

		// expect(await ERC721_Burn.name()).equal('PDE_Burn');
		// expect(await ERC721_Burn.symbol()).equal('BURN');
	});

	it('tests getTokensBurned', async function () {
		const {ERC721_Burn, deployer, accountOne, accountTwo} = await setup();

		await deployer.ERC721_Burn.safeMint(accountOne.address, 1000);

		expect(await ERC721_Burn.getTokensBurned(0)).equal(1000);
	});

	it('tests safeMint', async function () {
		const {ERC721_Burn, deployer, accountOne, accountTwo} = await setup();

		await deployer.ERC721_Burn.safeMint(accountOne.address, 1000);
		await deployer.ERC721_Burn.safeMint(accountOne.address, 100);

		expect(await ERC721_Burn.balanceOf(accountOne.address)).equal(2);
	});

	it('tests tokenURI', async function () {
		const {ERC721_Burn, deployer, accountOne} = await setup();

		await ERC721_Burn.safeMint(accountOne.address, 1);

		await deployer.ERC721_Burn.setTokenURI('TokenURI');

		expect(await ERC721_Burn.tokenURI(0)).equal('TokenURI');
	});

	it('tests burn', async function () {
		const {ERC721_Burn, deployer, accountOne} = await setup();

		await deployer.ERC721_Burn.safeMint(accountOne.address, 100);

		expect(await ERC721_Burn.balanceOf(accountOne.address)).equal(1);

		await deployer.ERC721_Burn.burn(0);
		await expect(deployer.ERC721_Burn.burn(0)).to.be.revertedWith('ERC721: invalid token ID');

		expect(await ERC721_Burn.balanceOf(accountOne.address)).equal(0);
		await expect(ERC721_Burn.getTokensBurned(0)).to.be.revertedWith('ERC721: invalid token ID');
	});

	it('tests accessRoles', async function () {
		const {accountOne} = await setup();

		await expect(accountOne.ERC721_Burn.safeMint(accountOne.address, 100)).to.be.revertedWith(
			'BURN: required role not granted'
		);
	});
});
